# 介護記録トレーニング（kaigo-kiroku-app）

EikaySunflower の受講生（介護福祉士を目指すミャンマー人）が、介護記録の書き方
（**事実と解釈を分ける・5W1H・SOAP**）を練習するためのスマホアプリです。
App Store / Google Play 向けに **Capacitor** でネイティブ化します。

## できること

| 画面 | 内容 |
| --- | --- |
| ホーム | 練習開始、記録の種類（12種）、最近の点数 |
| 練習 | 場面（シナリオ）を読む → 記録項目を入力 → 5W1H → SOAP → 自動採点・模範解答・解説 |
| 自由記録 | 自分で場面を考えて記録を書き、書き方だけチェック |
| 履歴 | 保存した記録の一覧・詳細・削除（端末内に保存） |
| 学ぶ | 記録の目的・留意点・SOAP・尊厳を守る言葉（国家試験の出題ポイント） |

記録の種類：バイタル／食事・水分／排泄／入浴／服薬／睡眠・夜間／口腔ケア／体位変換・移乗／活動・レク／様子・行動（認知症ケア）／ヒヤリハット・事故／申し送り

### 自動チェックの内容（`src/lib/checker.ts`）

- O（客観的情報）に **推測**（〜と思う、〜だろう、たぶん…）や **職員の感情**（かわいそう…）がないか
- **あいまいな量**（たくさん、少し、あまり…）→ 数字で書くよう提案
- **尊厳を傷つける表現**（徘徊、暴言、不穏、わがまま…）→ 行動をそのまま書くよう提案
- S に本人の言葉が「」で入っているか、O に **時刻・数字** があるか
- A が判断、P が行動になっているか
- 場面モードでは、入力項目の正誤と「書くべき要点」の有無を合わせて **100点満点** で採点

## 開発

```bash
cd kaigo-kiroku-app
npm install
npm run dev        # http://localhost:5173
npm test           # vitest（チェッカーと全シナリオの模範解答を検証）
npm run build      # dist/ を生成
```

## ストア版（Capacitor）

iOS は macOS + Xcode、Android は Android Studio が必要です。

```bash
npm run cap:ios        # build → sync → Xcode を開く（ios/ は作成済み）
npx cap add android    # Android は初回のみ（android/ が生成される）
npm run cap:android    # build → sync → Android Studio を開く
```

iPhone での試し方（TestFlight）は [docs/iOS_TestFlight手順.md](docs/iOS_TestFlight手順.md) を参照。

- App ID: `com.eikaysunflower.kaigokiroku`（`capacitor.config.ts`）
- データは `@capacitor/preferences` で端末内に保存（Web では localStorage）。サーバー不要。
- アイコンの元画像は `assets/icon.png`（1024×1024）。iOS のアイコン・起動画面は設定済み。

## 場面（シナリオ）の追加

`src/data/scenarios.ts` に追加します。`expected`（記録項目の正解）、`keyPoints`（文章に含むべき語）、
`model`（模範解答）、`explanation`（解説）をそろえると、`npm test` が模範解答で高得点になることを確認します。
