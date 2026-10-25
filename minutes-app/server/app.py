"""議事録アプリのサーバー（社内 Mac で動かす）。

起動: uvicorn app:app --host 127.0.0.1 --port 8000
"""
import hmac
import json
import logging
import secrets
import shutil
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import config
import db
import processing

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

if not config.APP_PASSWORD:
    raise SystemExit("APP_PASSWORD が設定されていません。server/.env に APP_PASSWORD=... を書いてください。")

@asynccontextmanager
async def lifespan(_app):
    processing.start_worker()
    yield


app = FastAPI(title="議事録アプリ", lifespan=lifespan)
COOKIE = "minutes_session"

LIST_FIELDS = "id, title, held_at, participants, location, tags, created_at, status, status_detail, error, duration, minutes"


# ---------------------------------------------------------------- 認証

def require_login(request: Request):
    token = request.cookies.get(COOKIE)
    if token:
        with db.cursor() as cur:
            cur.execute("SELECT expires_at FROM sessions WHERE token = ?", (token,))
            row = cur.fetchone()
        if row and row["expires_at"] > datetime.now().isoformat():
            return token
    raise HTTPException(status_code=401, detail="ログインが必要です")


class LoginBody(BaseModel):
    password: str


@app.post("/api/login")
def login(body: LoginBody, request: Request, response: Response):
    if not hmac.compare_digest(body.password.encode(), config.APP_PASSWORD.encode()):
        raise HTTPException(status_code=401, detail="パスワードが違います")
    token = secrets.token_urlsafe(32)
    expires = datetime.now() + timedelta(days=config.SESSION_DAYS)
    with db.cursor() as cur:
        cur.execute("DELETE FROM sessions WHERE expires_at < ?", (datetime.now().isoformat(),))
        cur.execute("INSERT INTO sessions (token, expires_at) VALUES (?, ?)", (token, expires.isoformat()))
    secure = request.headers.get("x-forwarded-proto", request.url.scheme) == "https"
    response.set_cookie(
        COOKIE, token, max_age=config.SESSION_DAYS * 86400, httponly=True, samesite="lax", secure=secure
    )
    return {"ok": True}


@app.post("/api/logout")
def logout(response: Response, token: str = Depends(require_login)):
    with db.cursor() as cur:
        cur.execute("DELETE FROM sessions WHERE token = ?", (token,))
    response.delete_cookie(COOKIE)
    return {"ok": True}


@app.get("/api/status")
def status(_: str = Depends(require_login)):
    return {"queue": processing.queue_size(), "ollama": processing.ollama_available(), "model": config.OLLAMA_MODEL}


# ---------------------------------------------------------------- 議事録

def _list_item(row):
    d = db.row_to_dict(row)
    minutes = d.pop("minutes") or {}
    d["summary"] = (minutes.get("summary") or "")[:120]
    return d


@app.get("/api/meetings")
def list_meetings(q: str = "", tag: str = "", date_from: str = "", date_to: str = "", _: str = Depends(require_login)):
    where, params = [], []
    for word in q.split():
        like = f"%{word}%"
        where.append("(title LIKE ? OR participants LIKE ? OR location LIKE ? OR tags LIKE ? OR minutes LIKE ? OR transcript_text LIKE ?)")
        params += [like] * 6
    if tag:
        where.append("tags LIKE ?")
        params.append(f"%{json.dumps(tag, ensure_ascii=False)}%")
    if date_from:
        where.append("held_at >= ?")
        params.append(date_from)
    if date_to:
        where.append("held_at < ?")
        params.append(date_to + "T99")  # その日の終わりまで含める
    sql = f"SELECT {LIST_FIELDS} FROM meetings"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY held_at DESC LIMIT 300"
    with db.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
    return [_list_item(r) for r in rows]


@app.get("/api/tags")
def list_tags(_: str = Depends(require_login)):
    with db.cursor() as cur:
        cur.execute("SELECT tags FROM meetings")
        rows = cur.fetchall()
    tags = set()
    for r in rows:
        tags.update(json.loads(r["tags"] or "[]"))
    return sorted(tags)


def _parse_tags(raw):
    try:
        value = json.loads(raw)
        if isinstance(value, list):
            return [str(t).strip() for t in value if str(t).strip()]
    except (ValueError, TypeError):
        pass
    return [t.strip() for t in str(raw).replace("、", ",").split(",") if t.strip()]


@app.post("/api/meetings")
def create_meeting(
    file: UploadFile = File(...),
    title: str = Form(...),
    held_at: str = Form(...),
    participants: str = Form(""),
    location: str = Form(""),
    tags: str = Form("[]"),
    client_id: str = Form(""),
    _: str = Depends(require_login),
):
    # 通信が切れて再送された場合に二重登録しない
    if client_id:
        existing = db.get_meeting(client_id)
        if existing:
            return existing

    meeting_id = client_id or uuid.uuid4().hex
    folder = config.AUDIO_DIR / meeting_id
    folder.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "").suffix.lower() or ".bin"
    source_name = "source" + suffix
    with open(folder / source_name, "wb") as f:
        shutil.copyfileobj(file.file, f, length=1024 * 1024)

    now = processing.now_iso()
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO meetings (id, title, held_at, participants, location, tags, created_at, updated_at, status, source_file)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)",
            (meeting_id, title.strip() or "無題の会議", held_at, participants.strip(), location.strip(),
             json.dumps(_parse_tags(tags), ensure_ascii=False), now, now, source_name),
        )
    processing.enqueue(meeting_id, "full")
    return db.get_meeting(meeting_id)


def _get_or_404(meeting_id):
    m = db.get_meeting(meeting_id)
    if m is None:
        raise HTTPException(status_code=404, detail="議事録が見つかりません")
    return m


@app.get("/api/meetings/{meeting_id}")
def get_meeting(meeting_id: str, _: str = Depends(require_login)):
    m = _get_or_404(meeting_id)
    m.pop("transcript_text", None)
    return m


class Todo(BaseModel):
    task: str
    owner: str = ""
    due: str = ""


class Minutes(BaseModel):
    summary: str = ""
    decisions: list[str] = []
    todos: list[Todo] = []
    next_agenda: list[str] = []


class Segment(BaseModel):
    start: float
    end: float
    text: str


class MeetingPatch(BaseModel):
    title: str | None = None
    held_at: str | None = None
    participants: str | None = None
    location: str | None = None
    tags: list[str] | None = None
    minutes: Minutes | None = None
    transcript: list[Segment] | None = None


@app.patch("/api/meetings/{meeting_id}")
def update_meeting(meeting_id: str, body: MeetingPatch, _: str = Depends(require_login)):
    _get_or_404(meeting_id)
    fields = body.model_dump(exclude_none=True)
    if "transcript" in fields:
        fields["transcript_text"] = "\n".join(s["text"] for s in fields["transcript"])
    fields["updated_at"] = processing.now_iso()
    db.update_meeting(meeting_id, **fields)
    return get_meeting(meeting_id)


@app.delete("/api/meetings/{meeting_id}")
def delete_meeting(meeting_id: str, _: str = Depends(require_login)):
    _get_or_404(meeting_id)
    with db.cursor() as cur:
        cur.execute("DELETE FROM meetings WHERE id = ?", (meeting_id,))
    shutil.rmtree(config.AUDIO_DIR / meeting_id, ignore_errors=True)
    return {"ok": True}


@app.post("/api/meetings/{meeting_id}/reprocess")
def reprocess(meeting_id: str, mode: str = "summary", _: str = Depends(require_login)):
    m = _get_or_404(meeting_id)
    if mode == "summary" and not m["transcript"]:
        mode = "full"
    processing.enqueue(meeting_id, "full" if mode == "full" else "summary")
    return get_meeting(meeting_id)


@app.get("/api/meetings/{meeting_id}/audio")
def get_audio(meeting_id: str, _: str = Depends(require_login)):
    m = _get_or_404(meeting_id)
    if not m["audio_file"]:
        raise HTTPException(status_code=404, detail="音声はまだ準備中です")
    # FileResponse は Range リクエストに対応しているので、iPhone で再生位置を移動できる
    return FileResponse(config.AUDIO_DIR / meeting_id / m["audio_file"], media_type="audio/mp4")


# ---------------------------------------------------------------- 画面（PWA）

@app.middleware("http")
async def no_cache_shell(request: Request, call_next):
    response = await call_next(request)
    if not request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-cache"
    return response


@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


app.mount("/", StaticFiles(directory=config.WEB_DIR, html=True), name="web")
