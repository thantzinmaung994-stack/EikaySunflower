"""SQLite によるデータ保存。"""
import json
import sqlite3
import threading
from contextlib import contextmanager

from config import DB_PATH

_lock = threading.RLock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    held_at TEXT NOT NULL,
    participants TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    status TEXT NOT NULL,
    status_detail TEXT NOT NULL DEFAULT '',
    error TEXT NOT NULL DEFAULT '',
    source_file TEXT NOT NULL DEFAULT '',
    audio_file TEXT NOT NULL DEFAULT '',
    duration REAL NOT NULL DEFAULT 0,
    transcript TEXT NOT NULL DEFAULT '[]',
    transcript_text TEXT NOT NULL DEFAULT '',
    minutes TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_meetings_held_at ON meetings(held_at);
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    expires_at TEXT NOT NULL
);
"""

JSON_FIELDS = ("tags", "transcript", "minutes")


def _connect():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


_conn = _connect()
_conn.executescript(SCHEMA)


@contextmanager
def cursor():
    with _lock:
        cur = _conn.cursor()
        try:
            yield cur
            _conn.commit()
        except Exception:
            _conn.rollback()
            raise


def row_to_dict(row):
    if row is None:
        return None
    d = dict(row)
    for f in JSON_FIELDS:
        if f in d:
            d[f] = json.loads(d[f] or ("[]" if f != "minutes" else "{}"))
    return d


def get_meeting(meeting_id):
    with cursor() as cur:
        cur.execute("SELECT * FROM meetings WHERE id = ?", (meeting_id,))
        return row_to_dict(cur.fetchone())


def update_meeting(meeting_id, **fields):
    if not fields:
        return
    for f in JSON_FIELDS:
        if f in fields:
            fields[f] = json.dumps(fields[f], ensure_ascii=False)
    cols = ", ".join(f"{k} = ?" for k in fields)
    with cursor() as cur:
        cur.execute(f"UPDATE meetings SET {cols} WHERE id = ?", (*fields.values(), meeting_id))
