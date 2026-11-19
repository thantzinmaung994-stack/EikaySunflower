import { describe, expect, it } from 'vitest';
import { charDiff, compareFindings, sameRatio } from './attempts';
import { checkSoap, type CheckResult } from './checker';

const res = (o: string): CheckResult => ({ findings: checkSoap({ s: '「痛い」', o, a: '発赤の可能性がある。', p: '看護師に報告する。' }), score: 0, keyPointHits: [], fieldHits: [] });

describe('書き直しの比較', () => {
  it('文字の差分：足したところ・消したところがわかる', () => {
    const d = charDiff('体を良く動かした', '体を両腕まで動かした');
    expect(d.filter((p) => p.type === 'del').map((p) => p.text).join('')).toBe('良く');
    expect(d.filter((p) => p.type === 'add').map((p) => p.text).join('')).toBe('両腕まで');
    expect(d.filter((p) => p.type !== 'del').map((p) => p.text).join('')).toBe('体を両腕まで動かした');
    expect(d.filter((p) => p.type !== 'add').map((p) => p.text).join('')).toBe('体を良く動かした');
  });

  it('同じ文なら差分なし、空からは全部追加', () => {
    expect(charDiff('同じ', '同じ')).toEqual([{ text: '同じ', type: 'same' }]);
    expect(charDiff('', '新しい')).toEqual([{ text: '新しい', type: 'add' }]);
  });

  it('大きく書き直したかどうか（同じ文字の割合）', () => {
    expect(sameRatio(charDiff('体温が高い', '体温が高い'))).toBe(1);
    expect(sameRatio(charDiff('朝、熱っぽい', '7:30 体温37.8℃、看護師に報告'))).toBeLessThan(0.5);
  });

  it('前回の指摘のうち直せたもの・新しく出たものを分ける', () => {
    const prev = res('入浴時、仙骨部に発赤があった。かわいそうだった。');
    const now = res('14:05 入浴時、仙骨部に直径約2cmの発赤があった。少し赤い。');
    const c = compareFindings(prev, now);
    expect(c.fixed.map((f) => f.code)).toEqual(expect.arrayContaining(['feeling', 'time', 'number']));
    expect(c.added.map((f) => f.code)).toContain('vague');
  });
});
