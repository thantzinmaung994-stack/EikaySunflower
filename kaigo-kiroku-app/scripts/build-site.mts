/**
 * App Store に登録する Web ページ（プライバシーポリシー・利用規約・サポート）を、
 * アプリ内の文章（src/data/info.ts）から作る。
 *   npm run site
 * 出力先：リポジトリの docs/kaigo-kiroku/（GitHub Pages で公開する）
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderSite } from '../src/lib/site';

const OUT = '../docs/kaigo-kiroku';
mkdirSync(OUT, { recursive: true });
for (const [name, html] of Object.entries(renderSite())) {
  writeFileSync(`${OUT}/${name}`, html);
  console.log(`docs/kaigo-kiroku/${name}`);
}
