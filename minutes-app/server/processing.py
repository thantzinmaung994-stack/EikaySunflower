"""音声の変換 → 文字起こし（mlx-whisper）→ 議事録作成（Ollama）を順番に処理するワーカー。

すべてこの Mac の中で実行され、外部サービスには何も送らない。
"""
import json
import logging
import queue
import subprocess
import threading
import time
import urllib.request
from datetime import datetime

import config
import db

log = logging.getLogger("minutes.processing")

_jobs: "queue.Queue[tuple[str, str]]" = queue.Queue()
_queued: set = set()
_queued_lock = threading.Lock()

# 再起動時に途中から再開すべき状態
PENDING_STATUSES = ("queued", "converting", "transcribing", "summarizing")


def now_iso():
    return datetime.now().isoformat(timespec="seconds")


def enqueue(meeting_id, mode="full"):
    """mode: full（文字起こしから）/ summary（議事録の作り直しのみ）"""
    with _queued_lock:
        if meeting_id in _queued:
            return
        _queued.add(meeting_id)
    db.update_meeting(meeting_id, status="queued", status_detail="処理待ち", error="", updated_at=now_iso())
    _jobs.put((meeting_id, mode))


def queue_size():
    return _jobs.qsize()


def start_worker():
    with db.cursor() as cur:
        cur.execute(
            f"SELECT id, transcript_text FROM meetings WHERE status IN ({','.join('?' * len(PENDING_STATUSES))})"
            " ORDER BY created_at",
            PENDING_STATUSES,
        )
        rows = cur.fetchall()
    for row in rows:
        enqueue(row["id"], "summary" if row["transcript_text"] else "full")
    threading.Thread(target=_worker_loop, daemon=True, name="minutes-worker").start()


def _worker_loop():
    while True:
        meeting_id, mode = _jobs.get()
        try:
            _process(meeting_id, mode)
        except Exception as e:  # noqa: BLE001 - 失敗内容を画面に出す
            log.exception("processing failed: %s", meeting_id)
            db.update_meeting(meeting_id, status="error", status_detail="", error=str(e)[:500], updated_at=now_iso())
        finally:
            with _queued_lock:
                _queued.discard(meeting_id)


def _set_status(meeting_id, status, detail):
    db.update_meeting(meeting_id, status=status, status_detail=detail, updated_at=now_iso())


def _process(meeting_id, mode):
    m = db.get_meeting(meeting_id)
    if m is None:
        return
    folder = config.AUDIO_DIR / meeting_id

    if mode == "full":
        _set_status(meeting_id, "converting", "音声を変換中")
        source = folder / m["source_file"]
        wav = folder / "work.wav"
        playback = folder / "audio.m4a"
        _ffmpeg(["-i", str(source), "-vn", "-ac", "1", "-ar", "16000", str(wav)])
        _ffmpeg(["-i", str(source), "-vn", "-ac", "1", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", str(playback)])
        duration = _probe_duration(playback)
        db.update_meeting(meeting_id, audio_file=playback.name, duration=duration)

        _set_status(meeting_id, "transcribing", f"文字起こし中（音声 {int(duration // 60)} 分）")
        segments = transcribe(wav)
        wav.unlink(missing_ok=True)
        text = "\n".join(s["text"] for s in segments)
        db.update_meeting(meeting_id, transcript=segments, transcript_text=text)
        m = db.get_meeting(meeting_id)

    _set_status(meeting_id, "summarizing", "議事録を作成中")
    minutes = summarize(m["transcript"], meeting_id)
    db.update_meeting(meeting_id, minutes=minutes, status="done", status_detail="", error="", updated_at=now_iso())


# ---------------------------------------------------------------- 音声処理

def _ffmpeg(args):
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"音声ファイルを読み込めませんでした: {r.stderr.strip()[:300]}")


def _probe_duration(path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True,
    )
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


# ---------------------------------------------------------------- 文字起こし

def transcribe(wav_path):
    if config.FAKE_ENGINES:
        return _fake_transcribe(wav_path)

    import mlx_whisper  # Mac（Apple Silicon）専用

    result = mlx_whisper.transcribe(
        str(wav_path),
        path_or_hf_repo=config.WHISPER_MODEL,
        language="ja",
        condition_on_previous_text=False,  # 同じ文の繰り返し（幻聴）を防ぐ
        verbose=None,
    )
    segments = []
    for s in result.get("segments", []):
        text = s["text"].strip()
        if text:
            segments.append({"start": round(float(s["start"]), 2), "end": round(float(s["end"]), 2), "text": text})
    return segments


def _fake_transcribe(wav_path):
    duration = _probe_duration(wav_path) or 30
    lines = [
        "それでは定例会議を始めます。",
        "まず先週の進捗について共有してください。",
        "テキストの第3章は今週中に完成予定です。",
        "では来週の授業は第3章から始めることに決定します。",
        "田中さんは金曜日までに資料をまとめてください。",
        "次回は受講生アンケートの結果を確認しましょう。",
    ]
    step = max(duration / len(lines), 1)
    return [{"start": round(i * step, 2), "end": round((i + 1) * step, 2), "text": t} for i, t in enumerate(lines)]


# ---------------------------------------------------------------- 議事録作成

FINAL_PROMPT = """あなたは優秀な議事録作成者です。以下の会議の内容をもとに、日本語で議事録を作成してください。

出力は次の形式のJSONのみとします。
{
  "summary": "会議の概要（3〜8文。誰が何を話し、何が論点だったか）",
  "decisions": ["決定事項", ...],
  "todos": [{"task": "やること", "owner": "担当者（不明なら空文字）", "due": "期限（不明なら空文字）"}, ...],
  "next_agenda": ["次回の議題", ...]
}

ルール:
- 会議で実際に話された内容だけを書き、推測で付け足さない
- 該当がない項目は空配列 [] にする
- 文字起こしの誤変換と思われる箇所は文脈から自然に補正する

会議情報:
{meta}

内容:
{body}
"""

CHUNK_PROMPT = """以下は会議の文字起こしの一部（{index}/{total}）です。この部分の重要な内容を日本語で抽出してください。

出力は次の形式のJSONのみとします。
{
  "points": ["話し合われた要点", ...],
  "decisions": ["決定事項", ...],
  "todos": [{"task": "やること", "owner": "担当者（不明なら空文字）", "due": "期限（不明なら空文字）"}, ...],
  "next_agenda": ["次回に持ち越し・次回の議題", ...]
}

話された内容だけを書き、推測で付け足さないでください。該当がない項目は [] にしてください。

文字起こし:
{body}
"""


def _fmt_time(sec):
    sec = int(sec)
    h, rest = divmod(sec, 3600)
    m, s = divmod(rest, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def _chunk_transcript(segments):
    chunks, current, size = [], [], 0
    for s in segments:
        line = f"[{_fmt_time(s['start'])}] {s['text']}"
        if current and size + len(line) > config.SUMMARY_CHUNK_CHARS:
            chunks.append("\n".join(current))
            current, size = [], 0
        current.append(line)
        size += len(line) + 1
    if current:
        chunks.append("\n".join(current))
    return chunks


def summarize(segments, meeting_id=None):
    if not segments:
        return {"summary": "音声から発言を認識できませんでした。", "decisions": [], "todos": [], "next_agenda": []}

    m = db.get_meeting(meeting_id) if meeting_id else None
    meta = ""
    if m:
        meta = f"会議名: {m['title']}\n日時: {m['held_at']}\n参加者: {m['participants'] or '不明'}"

    if config.FAKE_ENGINES:
        return _normalize({
            "summary": "（テスト用のダミー要約）第3章テキストの進捗を確認し、来週の授業方針を決めました。",
            "decisions": ["来週の授業は第3章から始める"],
            "todos": [{"task": "資料をまとめる", "owner": "田中", "due": "金曜日"}],
            "next_agenda": ["受講生アンケート結果の確認"],
        })

    chunks = _chunk_transcript(segments)
    if len(chunks) == 1:
        return _normalize(_ask_json(FINAL_PROMPT.replace("{meta}", meta).replace("{body}", chunks[0])))

    notes = []
    for i, chunk in enumerate(chunks, 1):
        if meeting_id:
            _set_status(meeting_id, "summarizing", f"議事録を作成中（{i}/{len(chunks) + 1}）")
        prompt = CHUNK_PROMPT.replace("{index}", str(i)).replace("{total}", str(len(chunks))).replace("{body}", chunk)
        notes.append(_ask_json(prompt))

    if meeting_id:
        _set_status(meeting_id, "summarizing", f"議事録を作成中（{len(chunks) + 1}/{len(chunks) + 1}）")
    body = "\n\n".join(
        f"【パート{i}】\n" + json.dumps(n, ensure_ascii=False, indent=1) for i, n in enumerate(notes, 1)
    )
    return _normalize(_ask_json(FINAL_PROMPT.replace("{meta}", meta).replace("{body}", "（各パートの要点メモ）\n" + body)))


def _ask_json(prompt, retries=2):
    payload = {
        "model": config.OLLAMA_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.2, "num_ctx": config.OLLAMA_NUM_CTX},
    }
    last_error = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(
                f"{config.OLLAMA_URL}/api/chat",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=1800) as res:
                body = json.loads(res.read().decode("utf-8"))
            return json.loads(body["message"]["content"])
        except Exception as e:  # noqa: BLE001
            last_error = e
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"議事録の作成に失敗しました（Ollama: {last_error}）")


def _str_list(value):
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return []
    return [str(v).strip() for v in value if str(v).strip()]


def _normalize(data):
    if not isinstance(data, dict):
        data = {}
    summary = data.get("summary", "")
    if isinstance(summary, list):
        summary = "\n".join(str(s) for s in summary)
    todos = []
    for t in data.get("todos") or []:
        if isinstance(t, dict):
            task = str(t.get("task", "")).strip()
            if task:
                todos.append({"task": task, "owner": str(t.get("owner") or "").strip(), "due": str(t.get("due") or "").strip()})
        elif str(t).strip():
            todos.append({"task": str(t).strip(), "owner": "", "due": ""})
    return {
        "summary": str(summary).strip(),
        "decisions": _str_list(data.get("decisions")),
        "todos": todos,
        "next_agenda": _str_list(data.get("next_agenda")),
    }


def ollama_available():
    if config.FAKE_ENGINES:
        return True
    try:
        with urllib.request.urlopen(f"{config.OLLAMA_URL}/api/tags", timeout=3) as res:
            return res.status == 200
    except Exception:  # noqa: BLE001
        return False
