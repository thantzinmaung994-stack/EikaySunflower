import { describe, expect, it } from 'vitest';
import { REPHRASE_QUIZ } from '../data/rephraseQuiz';
import { SOAP_QUIZ } from '../data/soapQuiz';
import { parseBackup } from './backup';
import { build5W1H, buildRephrase, buildSoap, buildTermQuiz, rephrasePool, soapPool, termPool, W_ITEMS, wPool } from './quizBuilders';
import { deckStats, review, todaysDeck } from './study';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9);

describe('flashcards (spaced repetition)', () => {
  it('moves a known card up a box and pushes the next date out', () => {
    const a = review(undefined, true, day(2026, 11, 9));
    expect(a).toEqual({ box: 1, due: '2026-11-10', misses: 0 });
    const b = review(a, true, day(2026, 11, 10));
    expect(b).toEqual({ box: 2, due: '2026-11-12', misses: 0 });
    const c = review({ box: 6, due: '', misses: 0 }, true, day(2026, 11, 9));
    expect(c.box).toBe(6);
    expect(c.due).toBe('2026-12-09');
  });
  it('sends a missed card back to box 1 and counts the miss', () => {
    expect(review({ box: 4, due: '2026-11-09', misses: 1 }, false, day(2026, 11, 9))).toEqual({ box: 1, due: '2026-11-10', misses: 2 });
  });
  it('shows due cards (oldest first) before new ones', () => {
    const cards = { a: { box: 2, due: '2026-11-08', misses: 0 }, b: { box: 1, due: '2026-11-05', misses: 0 }, c: { box: 3, due: '2026-12-01', misses: 0 } };
    expect(todaysDeck(['a', 'b', 'c', 'd', 'e'], cards, 3, day(2026, 11, 9))).toEqual(['b', 'a', 'd']);
    expect(deckStats(['a', 'b', 'c', 'd'], cards, day(2026, 11, 9))).toEqual({ total: 4, seen: 3, learned: 1, due: 2 });
  });
});

describe('quiz builders', () => {
  const valid = (items: { choices: string[]; answer: number }[]) =>
    items.every((x) => x.answer >= 0 && x.answer < x.choices.length && new Set(x.choices).size === x.choices.length);
  it('build valid questions for every kind', () => {
    expect(valid(buildSoap(true, 100))).toBe(true);
    expect(valid(buildRephrase(true, 70))).toBe(true);
    expect(valid(build5W1H(true, 50))).toBe(true);
    expect(valid(buildTermQuiz(true, 200))).toBe(true);
  });
  it('keep rephrase answers correct after shuffling the choices', () => {
    for (const q of buildRephrase(true, 70)) {
      const src = REPHRASE_QUIZ.find((x) => x.id === q.id)!;
      expect(q.choices[q.answer]).toBe(src.choices[src.answer]);
    }
  });
  it('open about a quarter to the free plan, with every answer type', () => {
    const soap = soapPool(false);
    expect(soap.length / SOAP_QUIZ.length).toBeCloseTo(0.25, 1);
    expect(new Set(soap.map((x) => x.answer)).size).toBe(4);
    expect(rephrasePool(false).length / REPHRASE_QUIZ.length).toBeGreaterThan(0.2);
    expect(new Set(rephrasePool(false).map((x) => x.point)).size).toBe(7);
    expect(wPool(false).length / W_ITEMS.length).toBeGreaterThan(0.2);
    expect(wPool(false).length / W_ITEMS.length).toBeLessThan(0.4);
    expect(termPool(false).length).toBeLessThan(termPool(true).length / 3);
    expect(buildTermQuiz(false, 50).every((q) => termPool(false).some((g) => q.id.endsWith(`:${g.term}`)))).toBe(true);
  });
});

describe('backup files', () => {
  it('accept a file written by this app', () => {
    const file = { app: 'com.eikaysunflower.kaigokiroku', version: 1, exportedAt: '2026-11-09T00:00:00Z', data: { 'kaigo-kiroku:records': '[{},{}]' } };
    expect(parseBackup(JSON.stringify(file))).toMatchObject({ ok: true, records: 2 });
  });
  it('reject other files with a plain reason', () => {
    expect(parseBackup('hello')).toMatchObject({ ok: false });
    expect(parseBackup(JSON.stringify({ app: 'other', version: 1, data: {} }))).toMatchObject({ ok: false, reason: expect.stringContaining('このアプリ') });
    expect(parseBackup(JSON.stringify({ app: 'com.eikaysunflower.kaigokiroku', version: 1, exportedAt: '', data: { evil: 'x' } }))).toMatchObject({ ok: false });
  });
});
