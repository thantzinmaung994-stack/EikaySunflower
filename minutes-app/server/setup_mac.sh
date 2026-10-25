#!/bin/bash
# 議事録サーバーのセットアップ（Apple Silicon の Mac 用）
# 使い方: ターミナルで  bash setup_mac.sh
set -euo pipefail
cd "$(dirname "$0")"
SERVER_DIR="$(pwd)"

echo "=== 議事録サーバーのセットアップ ==="

if [ "$(uname -m)" != "arm64" ]; then
  echo "⚠️  この Mac は Apple Silicon（M1/M2/M3/M4…）ではありません。文字起こし（mlx-whisper）が動きません。"
  exit 1
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew が見つかりません。先に https://brew.sh の手順でインストールしてください。"
  exit 1
fi

echo "--- 必要なソフトをインストール（ffmpeg / Ollama / Python）"
brew list ffmpeg >/dev/null 2>&1 || brew install ffmpeg
brew list ollama >/dev/null 2>&1 || brew install ollama
brew list python@3.12 >/dev/null 2>&1 || brew install python@3.12
brew services start ollama
sleep 3

# メモリ量に合わせてAIモデルを選ぶ
MEM_GB=$(( $(sysctl -n hw.memsize) / 1024 / 1024 / 1024 ))
if [ "$MEM_GB" -ge 16 ]; then LLM="qwen2.5:7b"; else LLM="qwen2.5:3b"; fi
echo "--- メモリ ${MEM_GB}GB → 議事録作成モデル: ${LLM}"
ollama pull "$LLM"

echo "--- Python の環境を作成"
"$(brew --prefix python@3.12)/bin/python3.12" -m venv .venv
./.venv/bin/pip install --upgrade pip -q
./.venv/bin/pip install -r requirements.txt -q

WHISPER="mlx-community/whisper-large-v3-turbo"
echo "--- 文字起こしモデルをダウンロード（約1.6GB・初回のみ）"
./.venv/bin/python -c "from huggingface_hub import snapshot_download; snapshot_download('$WHISPER')"

if [ ! -f .env ]; then
  echo ""
  read -r -s -p "アプリのログインパスワードを決めて入力してください（8文字以上推奨）: " PW
  echo ""
  cat > .env <<EOF
APP_PASSWORD=${PW}
WHISPER_MODEL=${WHISPER}
OLLAMA_MODEL=${LLM}
MINUTES_DATA_DIR=${HOME}/MinutesData
EOF
  chmod 600 .env
  echo "設定を server/.env に保存しました。"
fi

echo "--- 自動起動（ログイン時にサーバーが立ち上がるように設定）"
mkdir -p "$HOME/MinutesData/logs" "$HOME/Library/LaunchAgents"
PLIST="$HOME/Library/LaunchAgents/jp.eikaysunflower.minutes.plist"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>jp.eikaysunflower.minutes</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>${SERVER_DIR}/start.sh</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${HOME}/MinutesData/logs/server.log</string>
  <key>StandardErrorPath</key><string>${HOME}/MinutesData/logs/server.log</string>
</dict>
</plist>
EOF
chmod +x start.sh
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
sleep 3

if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/ | grep -q 200; then
  echo "✅ サーバーが起動しました（http://127.0.0.1:8000）"
else
  echo "⚠️  サーバーの起動を確認できませんでした。ログ: ~/MinutesData/logs/server.log"
fi

cat <<'EOF'

=== 次の手順（Tailscale で iPhone からつなぐ）===
1. Mac に Tailscale をインストールしてログイン（https://tailscale.com/download/mac）
2. Tailscale 管理画面 → DNS で「MagicDNS」と「HTTPS Certificates」を有効にする
3. ターミナルで:  tailscale serve --bg 8000
   （App Store 版の場合: /Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg 8000）
4. 表示された https://〇〇.ts.net の URL を iPhone で開く
詳しくは minutes-app/README.md を参照してください。
EOF
