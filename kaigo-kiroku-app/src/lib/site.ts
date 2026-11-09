/**
 * 公開用 Web ページの HTML を作る（scripts/build-site.mts から使う）。
 * 文章はアプリと同じ src/data/info.ts を使うので、アプリ内の表示と食い違わない。
 */
import { INFO_PAGES, OPERATOR, PRICE, type InfoPage } from '../data/info';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = `
:root{--navy:#002a5a;--gold:#ddb74b;--gold-text:#8a6414;--bg:#f7f5ef;--card:#fff;--text:#1b2433;--muted:#5b6475;--line:#e6dfcc;color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.8 -apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif}
header{background:#fff;border-bottom:3px solid var(--gold)}
header .in{max-width:760px;margin:0 auto;padding:14px max(16px,env(safe-area-inset-left,0px));display:flex;gap:10px;align-items:center}
header b{color:var(--navy);font-size:17px}
nav{max-width:760px;margin:0 auto;padding:10px max(16px,env(safe-area-inset-left,0px)) 0;display:flex;flex-wrap:wrap;gap:6px 14px;font-size:14px}
nav a{color:var(--navy)}nav a[aria-current]{font-weight:700;text-decoration:none;border-bottom:2px solid var(--gold)}
main{max-width:760px;margin:0 auto;padding:16px max(16px,env(safe-area-inset-left,0px)) 40px}
article{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px}
h1{color:var(--navy);font-size:22px;line-height:1.4;margin:0 0 12px}
h2{color:var(--navy);font-size:17px;margin:22px 0 4px}
p,li{max-width:65ch}ul{padding-left:20px;margin:4px 0}
.muted{color:var(--muted);font-size:14px}
footer{max-width:760px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-left,0px)) 30px;color:var(--muted);font-size:13px}
a{color:var(--navy)}
`;

const FILE: Record<InfoPage['id'] | 'support', string> = {
  privacy: 'privacy.html',
  terms: 'terms.html',
  about: 'about.html',
  howto: 'howto.html',
  support: 'support.html',
};

function layout(title: string, current: string, body: string): string {
  const links = [
    ['privacy.html', 'プライバシーポリシー'],
    ['terms.html', '利用規約'],
    ['support.html', 'サポート'],
    ['howto.html', '使い方'],
    ['about.html', '運営者情報'],
  ]
    .map(([href, label]) => `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`)
    .join('');
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}｜${esc(OPERATOR.service)}</title>
<meta name="description" content="${esc(OPERATOR.service)}（${esc(OPERATOR.name)}）の${esc(title)}">
<style>${STYLE}</style>
</head>
<body>
<header><div class="in"><b>${esc(OPERATOR.service)}</b><span class="muted">${esc(OPERATOR.name)}</span></div></header>
<nav>${links}</nav>
<main><article>
${body}
</article></main>
<footer>© ${esc(OPERATOR.name)}　お問い合わせ：${esc(OPERATOR.contact)}</footer>
</body>
</html>
`;
}

function pageBody(p: InfoPage): string {
  const sections = p.sections
    .map((s) => {
      const h = s.h ? `<h2>${esc(s.h)}</h2>\n` : '';
      const body = s.p.length > 1 ? `<ul>${s.p.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p>${esc(s.p[0])}</p>`;
      return h + body;
    })
    .join('\n');
  return `<h1>${esc(p.title)}</h1>\n${sections}`;
}

/** App Store の「サポート URL」用。よくある質問とお問い合わせ先 */
function supportBody(): string {
  const faq: [string, string][] = [
    ['購入した有料プランが使えなくなった', 'アプリの「設定」→「プレミアム」→「購入を復元」を押してください。購入したときと同じ Apple ID でサインインしている必要があります。'],
    ['解約したい', `iPhone の「設定」→ 自分の名前 →「サブスクリプション」→「介護記録トレーニング」から解約できます。期間の途中で解約しても、その期間の終わりまでは使えます（${PRICE.label}）。`],
    ['返金してほしい', '定期購入の代金は Apple が受け取っています。返金は Apple のページ（reportaproblem.apple.com）から申し込んでください。'],
    ['機種変更で学習記録を移したい', '古い端末でアプリの「設定」→「バックアップ」→「書き出す」で記録のファイルを保存し、新しい端末で「読み込む」を選んでください。有料プランは「購入を復元」で戻ります。'],
    ['毎日のお知らせが来ない', 'iPhone の「設定」→「通知」→「介護記録トレーニング」で通知を許可し、アプリの「設定」でお知らせを ON にしてください。'],
    ['受講生コードを使いたい', 'アプリの「設定」→「プレミアム」→「受講生コードを使う」を押して、スクールから受け取ったコードを入力してください。'],
    ['ミャンマー語や内容のまちがいを見つけた', '下のメールアドレスに、画面の名前とまちがっている文を送ってください。'],
  ];
  return `<h1>サポート</h1>
<p>アプリについてのお問い合わせは、次のメールアドレスにお送りください。通常3営業日以内にお返事します。</p>
<p><b>${esc(OPERATOR.contact)}</b></p>
<h2>よくある質問</h2>
${faq.map(([q, a]) => `<h2 style="font-size:15px">Q. ${esc(q)}</h2><p>${esc(a)}</p>`).join('\n')}`;
}

/** ファイル名 → HTML */
export function renderSite(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of INFO_PAGES) out[FILE[p.id]] = layout(p.title, FILE[p.id], pageBody(p));
  out[FILE.support] = layout('サポート', FILE.support, supportBody());
  out['index.html'] = layout(
    OPERATOR.service,
    '',
    `<h1>${esc(OPERATOR.service)}</h1>
<p>介護記録の書き方（事実と解釈の区別・5W1H・SOAP）を練習する、介護福祉士国家試験を目指す方のための学習アプリです。日本語・ミャンマー語に対応しています。</p>
<ul>${['privacy.html', 'terms.html', 'support.html', 'howto.html', 'about.html'].map((f) => `<li><a href="${f}">${esc({ 'privacy.html': 'プライバシーポリシー', 'terms.html': '利用規約', 'support.html': 'サポート・お問い合わせ', 'howto.html': '使い方', 'about.html': '運営者情報' }[f]!)}</a></li>`).join('')}</ul>`,
  );
  return out;
}
