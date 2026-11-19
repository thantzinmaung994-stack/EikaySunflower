#!/bin/bash
# 議事録サーバーを起動する（launchd から自動で呼ばれる）
cd "$(dirname "$0")"

# AIモデルはセットアップ時にダウンロード済み。以降はインターネットに一切問い合わせない
export HF_HUB_OFFLINE=1
export HF_HUB_DISABLE_TELEMETRY=1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# caffeinate: サーバー動作中は Mac をスリープさせない（電源接続時）
# 127.0.0.1 のみで待ち受け、外からは Tailscale 経由でしか接続できない
exec caffeinate -is ./.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8000
