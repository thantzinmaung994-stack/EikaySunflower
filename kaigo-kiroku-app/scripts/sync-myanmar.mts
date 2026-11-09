/**
 * translations/myanmar.csv を最新の内容にそろえる。
 *   npm run my:sync
 * - 新しく増えた場面・問題・用語・画面の文字の行を追加する（ミャンマー語は空欄）
 * - すでに入っている「ミャンマー語」「確認済み」はそのまま残す
 * - 日本語の列は参考用に毎回作り直す
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseCsv } from '../src/lib/csv';
import { sourceRows } from '../src/lib/translationRows';

const FILE = 'translations/myanmar.csv';

const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

{
  const [header, ...old] = parseCsv(readFileSync(FILE, 'utf8'));
  const ki = header.indexOf('key');
  const mi = header.findIndex((h) => h.includes('ミャンマー'));
  const ci = header.findIndex((h) => h.includes('確認'));
  const prev = new Map(old.map((r) => [r[ki], { my: r[mi] ?? '', ok: r[ci] ?? '' }]));
  const rows = sourceRows().map(([k, kind, ja]) => [k, kind, ja, prev.get(k)?.my ?? '', prev.get(k)?.ok ?? '']);
  const keys = new Set(rows.map((r) => r[0]));
  const dropped = [...prev.keys()].filter((k) => k && !keys.has(k) && prev.get(k)!.my);
  const out = [['key', '種類', '日本語（原文・参考）', 'ミャンマー語', '確認済み'], ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
  writeFileSync(FILE, '﻿' + out);
  const added = rows.filter((r) => !prev.has(r[0])).length;
  console.log(`${rows.length} 行（新規 ${added} 行、訳あり ${rows.filter((r) => r[3]).length} 行）`);
  if (dropped.length) console.log('もう使われていない訳（削除しました）:', dropped.join(', '));
}
