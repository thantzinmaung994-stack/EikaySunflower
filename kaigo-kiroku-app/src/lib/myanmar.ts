/**
 * ミャンマー語の文章は translations/myanmar.csv にまとめてある。
 * Excel や Google スプレッドシートで「ミャンマー語」列を直して上書き保存すれば、次のビルドから反映される。
 * 空欄のものは日本語で表示する。
 */
import csvText from '../../translations/myanmar.csv?raw';
import { parseCsv } from './csv';

function load(text: string): Map<string, string> {
  const [header, ...rows] = parseCsv(text);
  const ki = header.indexOf('key');
  const mi = header.findIndex((h) => h.includes('ミャンマー'));
  const m = new Map<string, string>();
  for (const r of rows) {
    const v = (r[mi] ?? '').trim();
    if (r[ki] && v) m.set(r[ki], v);
  }
  return m;
}

const MY = load(csvText);

/** ミャンマー語訳（なければ undefined） */
export const my = (key: string): string | undefined => MY.get(key);

export const myKeys = () => [...MY.keys()];
