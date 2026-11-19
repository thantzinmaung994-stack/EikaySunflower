"""設定値。すべて環境変数（server/.env）で上書きできる。"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR.parent / "web"


def _load_env_file():
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file()

DATA_DIR = Path(os.environ.get("MINUTES_DATA_DIR", Path.home() / "MinutesData")).expanduser()
AUDIO_DIR = DATA_DIR / "audio"
DB_PATH = DATA_DIR / "minutes.db"

APP_PASSWORD = os.environ.get("APP_PASSWORD", "")

WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "mlx-community/whisper-large-v3-turbo")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")
OLLAMA_NUM_CTX = int(os.environ.get("OLLAMA_NUM_CTX", "16384"))
# 1回でLLMに渡す文字起こしの文字数。長い会議はこの単位で分割して要約する
SUMMARY_CHUNK_CHARS = int(os.environ.get("SUMMARY_CHUNK_CHARS", "6000"))

# 1 にするとAIを使わずダミー結果を返す（動作確認用）
FAKE_ENGINES = os.environ.get("MINUTES_FAKE", "") == "1"

SESSION_DAYS = 90

DATA_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
