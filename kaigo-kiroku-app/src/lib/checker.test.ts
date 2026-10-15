import { describe, expect, it } from 'vitest';
import { categoryById } from '../data/categories';
import { SCENARIOS } from '../data/scenarios';
import type { RecordEntry } from '../types';
import { checkSoap, evaluate } from './checker';

const entryFor = (sc: (typeof SCENARIOS)[number], over: Partial<RecordEntry> = {}): RecordEntry => ({
  id: 'x',
  createdAt: new Date().toISOString(),
  mode: 'scenario',
  scenarioId: sc.id,
  category: sc.category,
  resident: sc.resident,
  fields: Object.fromEntries(Object.entries(sc.expected).map(([k, v]) => [k, String(v.value)])),
  w: { when: '', where: '', who: '', what: '', why: '', how: '' },
  soap: sc.model.soap,
  ...over,
});

describe('checkSoap', () => {
  it('flags speculation in O', () => {
    const f = checkSoap({ s: '「だるい」', o: '7:30 体温37.8℃。風邪をひいたのだと思う。', a: '発熱の可能性がある', p: '再測定する' });
    expect(f.some((x) => x.severity === 'error' && x.part === 'O' && x.match === 'のだと思')).toBe(true);
  });
  it('flags vague words and labels', () => {
    const f = checkSoap({ s: '「帰る」', o: '16:30 徘徊あり。水分を少し飲んだ。', a: '不安が考えられる', p: '声かけする' });
    expect(f.find((x) => x.match === '徘徊')?.severity).toBe('error');
    expect(f.find((x) => x.match === '少し')?.severity).toBe('warn');
  });
  it('warns when time or numbers missing', () => {
    const f = checkSoap({ s: '「痛い」', o: '居室で本人が腰を押さえていた様子を確認した', a: '痛みの可能性', p: '看護師へ報告する' });
    expect(f.some((x) => x.message.includes('時刻'))).toBe(true);
    expect(f.some((x) => x.message.includes('数字'))).toBe(true);
  });
  it('accepts full-width digits as time', () => {
    const f = checkSoap({ s: '「痛い」', o: '７：３０ 居室で体温３７.８℃を測定した。看護師に報告した。', a: '発熱の可能性がある', p: '再測定する' });
    expect(f.some((x) => x.severity === 'warn' && x.message.includes('時刻'))).toBe(false);
  });
});

describe('evaluate against model answers', () => {
  for (const sc of SCENARIOS) {
    it(`${sc.id}: model answer scores >= 85`, () => {
      const r = evaluate(entryFor(sc), sc, categoryById(sc.category));
      const missed = r.keyPointHits.filter((k) => !k.hit).map((k) => k.label);
      const wrong = r.fieldHits.filter((k) => !k.ok).map((k) => `${k.label}: ${k.actual} != ${k.expected}`);
      expect(missed, `missed key points`).toEqual([]);
      expect(wrong, `wrong fields`).toEqual([]);
      expect(r.findings.filter((f) => f.severity === 'error')).toEqual([]);
      expect(r.score).toBeGreaterThanOrEqual(85);
    });
  }
  it('empty answer scores low', () => {
    const sc = SCENARIOS[0];
    const r = evaluate(entryFor(sc, { fields: {}, soap: { s: '', o: 'だるそうだった。', a: '', p: '' } }), sc, categoryById(sc.category));
    expect(r.score).toBeLessThan(30);
  });
});

describe('overlapping words', () => {
  it('reports のだと思 only once', () => {
    const f = checkSoap({ s: '「だるい」', o: '7:30 体温37.8℃。風邪をひいたのだと思う。', a: '可能性がある', p: '観察する' });
    expect(f.filter((x) => x.severity === 'error').map((x) => x.match)).toEqual(['のだと思']);
  });
});
