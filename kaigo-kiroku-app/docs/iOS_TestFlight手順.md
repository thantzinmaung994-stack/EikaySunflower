# iPhone で試す（TestFlight）手順

Mac で行います。所要時間は初回で 30〜60 分ほどです。
iOS 用のプロジェクト（`ios/` フォルダ）・アイコン・起動画面は作成済みなので、Mac では「開いてアップロードする」だけです。

## 0. Mac に入れておくもの（初回のみ）

1. **Xcode**：Mac の App Store で「Xcode」を検索してインストール（無料・大きいので時間がかかります）
2. **Node.js**：https://nodejs.org/ja から「LTS」をダウンロードしてインストール
3. **GitHub Desktop**（コードを Mac に持ってくるため）：https://desktop.github.com/

Xcode を一度起動し、「Xcode → Settings → Accounts」で **Apple Developer に登録した Apple ID** を追加しておきます。

## 1. App Store Connect にアプリを登録（初回のみ）

1. https://appstoreconnect.apple.com を開く →「アプリ」→ 左上の「＋」→「新規アプリ」
2. 次のように入力：
   - プラットフォーム：iOS
   - 名前：介護記録トレーニング（ストアに表示される名前。ほかのアプリと重複していると使えません）
   - 主言語：日本語
   - バンドルID：**com.eikaysunflower.kaigokiroku**
     （一覧に出ない場合は、https://developer.apple.com/account/resources/identifiers で「＋」→「App IDs」→ 同じIDで登録してから戻る）
   - SKU：kaigokiroku001（自由な英数字）
3.「作成」

## 2. コードを Mac に持ってくる

1. GitHub Desktop で「File → Clone repository」→ `thantzinmaung994-stack/EikaySunflower` を選んで Clone
2. ブランチを `claude/elegant-albattani-ws404w` に切り替える（PR がマージ済みなら `main` のままで OK）

## 3. アプリを組み立てて Xcode を開く

Mac の「ターミナル」アプリを開き、1 行ずつ貼り付けて Enter：

```bash
cd ~/Documents/GitHub/EikaySunflower/kaigo-kiroku-app
npm install
npm run cap:ios
```

最後のコマンドで Xcode が自動で開きます。

## 4. Xcode で署名の設定（初回のみ）

1. 左の一覧で一番上の **App**（青いアイコン）をクリック
2. 中央の「TARGETS」で **App** を選び、上のタブ「**Signing & Capabilities**」
3. 「Automatically manage signing」に✓
4. 「Team」で **自分の Apple Developer チーム** を選ぶ
5. Bundle Identifier が `com.eikaysunflower.kaigokiroku` になっていることを確認

## 5. まず手元の iPhone で動かしてみる（任意）

1. iPhone を USB ケーブルで Mac につなぐ
2. Xcode の上部中央の実行先を、つないだ iPhone に変える
3. ▶（Run）ボタンを押す
4. iPhone に「信頼されていないデベロッパ」と出たら：iPhone の「設定 → 一般 → VPNとデバイス管理」で自分の開発者を「信頼」
   （iOS 16 以降で「デベロッパモード」を求められたら「設定 → プライバシーとセキュリティ → デベロッパモード」をオン）

## 6. TestFlight にアップロード

1. Xcode 上部の実行先を **Any iOS Device (arm64)** にする
2. メニュー「**Product → Archive**」（数分かかります）
3. 終わると「Organizer」画面が開くので「**Distribute App**」→「**App Store Connect**」→「Upload」→ あとは「Next」で進めて「Upload」
4. 10〜30 分ほどで App Store Connect の「TestFlight」タブにビルドが表示されます

## 7. iPhone に入れる

1. App Store Connect →「TestFlight」→「内部テスト」の「＋」でグループを作り、テストする人（自分や講師の Apple ID）を追加
2. 追加された人に招待メールが届く
3. iPhone に **TestFlight** アプリ（App Store で無料）を入れ、招待メールのリンクを開く →「インストール」

受講生など外部の人に配るときは「外部テスト」を使います（初回だけ Apple の簡単な審査があります）。

## 2 回目以降（アプリを更新したとき）

```bash
cd ~/Documents/GitHub/EikaySunflower/kaigo-kiroku-app
git pull          # または GitHub Desktop で Fetch / Pull
npm run cap:ios
```

Xcode で「App → General」の **Build** の数字を 1 つ増やして（1 → 2 → 3…）、手順 6 を繰り返します。

## うまくいかないとき

| 症状 | 対処 |
| --- | --- |
| `npm: command not found` | Node.js をインストールしてターミナルを開き直す |
| Signing で赤いエラー | Xcode の Settings → Accounts に Apple ID が入っているか、Team を選んだか確認 |
| 「No such module 'Capacitor'」 | Xcode の「File → Packages → Reset Package Caches」の後、もう一度 ▶ |
| Archive がグレーで押せない | 実行先が「Any iOS Device (arm64)」になっているか確認 |

エラー画面はスクリーンショットを送ってもらえれば、次にやることを案内します。
