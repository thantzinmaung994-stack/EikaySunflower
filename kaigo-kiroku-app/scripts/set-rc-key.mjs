/**
 * RevenueCat の公開キー（appl_ で始まる）を .env に入れる。
 *   npm run rc:key -- appl_xxxxxxxx
 * 入れたあと `npm run cap:ios` でアプリを作り直すと、購入画面が使えるようになる。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const key = (process.argv[2] ?? '').trim();
if (!/^appl_[A-Za-z0-9]{10,}$/.test(key)) {
  console.error('キーの形が正しくありません。RevenueCat の「API keys」にある、appl_ で始まる Public API key を指定してください。');
  console.error('例： npm run rc:key -- appl_AbCdEfGhIjKlMnOp');
  if (/^(sk_|atk_)/.test(key)) console.error('※ sk_ で始まるキーは秘密のキーです。アプリには入れないでください。');
  process.exit(1);
}
const FILE = '.env';
const lines = existsSync(FILE) ? readFileSync(FILE, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('VITE_RC_IOS_KEY=')) : [];
writeFileSync(FILE, [`VITE_RC_IOS_KEY=${key}`, ...lines].join('\n') + '\n');
console.log(`.env に iOS 用のキーを入れました（${key.slice(0, 9)}…）。続けて「npm run cap:ios」を実行してください。`);
