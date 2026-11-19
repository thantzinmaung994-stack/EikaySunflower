import type { CheckResult } from './checker';
import type { Finding, Soap } from '../types';

/** 書き直し前の1回分（採点画面で、前回と今回を並べるため） */
export interface Attempt {
  soap: Soap;
  result: CheckResult;
}

export type DiffPart = { text: string; type: 'same' | 'add' | 'del' };

/**
 * 1文字ずつの差分（日本語は単語の区切りがないので文字単位）。
 * 記録の文は長くても数百文字なので、そのまま表で計算する。
 */
export function charDiff(a: string, b: string): DiffPart[] {
  const x = [...a];
  const y = [...b];
  const n = x.length;
  const m = y.length;
  // 長すぎるときは、全部消して全部足したことにする（画面が固まらないように）
  if (n * m > 400_000) return [...(a ? [{ text: a, type: 'del' as const }] : []), ...(b ? [{ text: b, type: 'add' as const }] : [])];
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (text: string, type: DiffPart['type']) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ text, type });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      push(x[i], 'same');
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) push(x[i++], 'del');
    else push(y[j++], 'add');
  }
  while (i < n) push(x[i++], 'del');
  while (j < m) push(y[j++], 'add');
  return out;
}

/** 同じ文字の割合（0〜1）。大きく書き直したときは、差分より前後を並べたほうが読みやすい */
export function sameRatio(parts: DiffPart[]): number {
  const same = parts.filter((p) => p.type === 'same').reduce((n, p) => n + [...p.text].length, 0);
  const a = parts.filter((p) => p.type !== 'add').reduce((n, p) => n + [...p.text].length, 0);
  const b = parts.filter((p) => p.type !== 'del').reduce((n, p) => n + [...p.text].length, 0);
  return Math.max(a, b) ? same / Math.max(a, b) : 1;
}

const key = (f: Finding) => `${f.code ?? f.message}|${f.part}|${f.match ?? ''}`;
const problems = (r: CheckResult) => r.findings.filter((f) => f.severity === 'error' || f.severity === 'warn');

/** 前回の指摘のうち直せたもの・今回あらたに出たもの */
export function compareFindings(prev: CheckResult, now: CheckResult) {
  const before = problems(prev);
  const after = problems(now);
  const nowKeys = new Set(after.map(key));
  const prevKeys = new Set(before.map(key));
  return {
    fixed: before.filter((f) => !nowKeys.has(key(f))),
    added: after.filter((f) => !prevKeys.has(key(f))),
    remaining: after.filter((f) => prevKeys.has(key(f))),
  };
}
