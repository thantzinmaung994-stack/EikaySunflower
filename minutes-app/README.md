# 議事録アプリ（社内用・無料・情報を外に出さない）

iPhone で会議を録音し、社内の Mac で **文字起こし → AI議事録作成** まで行うアプリです。
音声も文字も **社外のサービスには一切送りません**（すべて Mac の中で処理・保存）。費用は 0 円です。

```
iPhone（ホーム画面に追加したWebアプリ）
   │  Tailscale（無料・暗号化された社内専用回線。外出先からもOK）
   ▼
社内 Mac
   ├ 文字起こし：Whisper large-v3 turbo（mlx-whisper・Apple Silicon で高速）
   ├ 議事録作成：Ollama + Qwen2.5（ローカルAI）
   └ 保存：~/MinutesData（音声・文字起こし・議事録）
```

## できること

| 機能 | 内容 |
|---|---|
| 録音 | ワンタップ録音・一時停止・音量メーター。10秒ごとに端末へ自動保存し、アプリが落ちても次回起動時に復元 |
| 取り込み | iPhone 標準「ボイスメモ」や Zoom 等の録音・録画ファイルを取り込み |
| 文字起こし | 時刻付き。時刻をタップするとその場面から再生 |
| AI議事録 | 概要／決定事項／ToDo（担当・期限）／次回の議題 を自動作成 |
| 会議情報 | タイトル・日時・参加者・場所・タグ |
| 一覧・検索 | キーワード（議事録・文字起こし本文も対象）、タグ、期間で絞り込み |
| 編集 | 議事録・ToDo・文字起こしを直接修正 |
| 共有・出力 | コピー／LINE・メールで共有／PDF保存 |
| 圏外対策 | 送信できないときは端末に残し、通信が戻ったら自動で再送 |

## 録音についての注意（iPhone）

- アプリ内録音は **画面をつけたまま** にしてください（画面を消すと iPhone の仕様で止まります）。充電しながらの利用がおすすめです。
- 画面を消したい・長時間で不安な場合は、**標準の「ボイスメモ」で録音** →「共有」→「"ファイル"に保存」→ アプリの「＋」→「ファイルを取り込む」。最も安定します。

---

## セットアップ（Mac 側・最初の1回だけ）

**必要なもの**：Apple Silicon（M1 以降）の Mac。メモリ 16GB 以上推奨（8GB でも小さいAIモデルで動作）。空き容量 15GB 程度。

1. **Homebrew** をインストール（未導入の場合）: https://brew.sh の手順どおり
2. このフォルダを Mac にダウンロード（GitHub の「Code → Download ZIP」など）
3. ターミナルで実行：
   ```bash
   cd ダウンロードした場所/minutes-app/server
   bash setup_mac.sh
   ```
   - AIモデルのダウンロード（合計 6GB 前後）があるため、初回は時間がかかります
   - 途中で **アプリのログインパスワード** を決めて入力します（社員に共有するもの）
   - 完了すると Mac にログインするたびにサーバーが自動起動します
4. **Mac をスリープさせない設定**：システム設定 → ディスプレイ（または バッテリー）→ 詳細 →「電源アダプタ接続時はディスプレイがオフのときに自動でスリープさせない」をオン。MacBook の場合は電源につないでおきます。

## 外出先からつなぐ設定（Tailscale・無料）

1. https://tailscale.com で **会社用のアカウント** を作成（Google アカウント等でログイン可）
2. Mac に Tailscale をインストールしてログイン：https://tailscale.com/download/mac
3. Tailscale 管理画面（https://login.tailscale.com/admin/dns）で **MagicDNS** と **HTTPS Certificates** を有効化
4. Mac のターミナルで：
   ```bash
   tailscale serve --bg 8000
   ```
   （App Store 版の場合は `/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg 8000`）
   表示される `https://〇〇〇.〇〇〇.ts.net` がアプリの URL です
5. 各社員の iPhone：
   1. App Store で「Tailscale」をインストールし、**同じ会社アカウント** でログイン（VPN をオン）
   2. Safari で上記 URL を開く → 共有ボタン →「ホーム画面に追加」
   3. ホーム画面のアイコンから開き、パスワードでログイン

> Tailscale の無料プランには利用者数の上限があります。人数が多い場合は、会社で1つの Tailscale アカウントを作り、各 iPhone でそのアカウントにログインする運用にしてください。
> サーバーは Mac の外（社内LAN含む）から直接は接続できず、Tailscale 経由でのみ使えます。

## 処理時間の目安（2時間の会議）

| Mac | 文字起こし | 議事録作成 |
|---|---|---|
| M1 / M2（16GB） | 10〜25分 | 5〜15分 |
| M3 / M4 | 5〜15分 | 3〜10分 |

※ 目安です。処理中もアプリは使えます。完了すると一覧の「処理中」表示が消えます。

## 運用メモ

- **データの場所**：`~/MinutesData`（`minutes.db` と `audio/`）。Time Machine でバックアップしてください
- **ログ**：`~/MinutesData/logs/server.log`
- **サーバー再起動**：`launchctl kickstart -k gui/$(id -u)/jp.eikaysunflower.minutes`
- **パスワード変更**：`server/.env` の `APP_PASSWORD` を書き換えて再起動
- **AIモデル変更**：`server/.env` の `OLLAMA_MODEL`（例 `qwen2.5:14b`、事前に `ollama pull`）、`WHISPER_MODEL`（変更後は `setup_mac.sh` を再実行してダウンロード）
- **動作確認用**：`MINUTES_FAKE=1` を付けて起動すると、AIを使わずダミー結果で画面確認できます

## ファイル構成

```
minutes-app/
├ server/          Mac で動くサーバー（Python / FastAPI / SQLite）
│  ├ app.py         API・画面配信・ログイン
│  ├ processing.py  音声変換 → 文字起こし → 議事録作成
│  ├ setup_mac.sh   セットアップ
│  └ start.sh       起動（launchd から自動実行）
└ web/             iPhone 用の画面（PWA）
```
