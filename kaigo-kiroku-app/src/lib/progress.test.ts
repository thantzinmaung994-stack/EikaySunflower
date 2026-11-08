import { describe, expect, it } from 'vitest';
import type { QuizResult, RecordEntry } from '../types';
import { activeDays, dayKey, missedQuizIds, reviewScenarios, streak, todaysScenario } from './progress';

const rec = (date: string, extra: Partial<RecordEntry> = {}): RecordEntry => ({
  id: Math.random().toString(36),
  createdAt: new Date(date).toISOString(),
  mode: 'free',
  category: 'vital',
  resident: '',
  fields: {},
  w: { when: '', where: '', who: '', what: '', why: '', how: '' },
  soap: { s: '', o: '', a: '', p: '' },
  ...extra,
});

const quiz = (date: string, asked: string[], wrong: string[]): QuizResult => ({
  id: Math.random().toString(36),
  createdAt: new Date(date).toISOString(),
  total: asked.length,
  correct: asked.length - wrong.length,
  askedIds: asked,
  wrongIds: wrong,
});

describe('streak', () => {
  const today = new Date(2026, 10, 7, 9, 0);
  it('counts consecutive days including today', () => {
    const days = activeDays([rec('2026-11-07T08:00'), rec('2026-11-06T21:00'), rec('2026-11-05T10:00')], []);
    expect(streak(days, today)).toEqual({ count: 3, doneToday: true });
  });
  it('keeps the streak alive when only yesterday is done', () => {
    const days = activeDays([rec('2026-11-06T21:00'), rec('2026-11-05T10:00')], []);
    expect(streak(days, today)).toEqual({ count: 2, doneToday: false });
  });
  it('breaks after a missed day', () => {
    const days = activeDays([rec('2026-11-05T10:00')], [quiz('2026-11-04T10:00', ['f01'], [])]);
    expect(streak(days, today).count).toBe(0);
  });
  it('uses local dates', () => {
    expect(dayKey(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02');
  });
});

describe('review and missed quiz items', () => {
  it('lists scenarios whose best score is under 80, worst first', () => {
    const r = reviewScenarios([
      rec('2026-11-01', { scenarioId: 'vital-01', score: 60 }),
      rec('2026-11-02', { scenarioId: 'vital-01', score: 70 }),
      rec('2026-11-02', { scenarioId: 'meal-01', score: 40 }),
      rec('2026-11-03', { scenarioId: 'bath-01', score: 90 }),
    ]);
    expect(r.map((x) => [x.scenario.id, x.best])).toEqual([['meal-01', 40], ['vital-01', 70]]);
  });
  it('drops a missed quiz item once it is answered correctly later', () => {
    // 新しい順に並ぶ
    const q = [quiz('2026-11-03', ['f01', 'f03'], ['f03']), quiz('2026-11-01', ['f01', 'f02'], ['f01', 'f02'])];
    expect(missedQuizIds(q).sort()).toEqual(['f02', 'f03']);
  });
  it('picks the same scenario all day, preferring unmastered ones', () => {
    const d = new Date(2026, 10, 7, 8);
    const a = todaysScenario([], d);
    expect(todaysScenario([], new Date(2026, 10, 7, 22))).toBe(a);
    const b = todaysScenario([rec('2026-11-07', { scenarioId: a.id, score: 95 })], d);
    expect(b.id).not.toBe(a.id);
  });
});

describe('free plan', () => {
  it('has exactly three free scenarios per record type', async () => {
    const { SCENARIOS } = await import('../data/scenarios');
    const { CATEGORIES } = await import('../data/categories');
    const { isFreeScenario } = await import('./premium');
    for (const c of CATEGORIES) {
      expect(SCENARIOS.filter((s) => s.category === c.id && isFreeScenario(s)).length, c.id).toBe(3);
    }
  });
  it('opens about a quarter of the quiz and the glossary, balanced', async () => {
    const { FACT_QUIZ } = await import('../data/factQuiz');
    const { GLOSSARY, GLOSSARY_GROUPS } = await import('../data/glossary');
    const { isFreeQuiz, isFreeTerm } = await import('./premium');
    const fq = FACT_QUIZ.filter(isFreeQuiz);
    expect(fq.length / FACT_QUIZ.length).toBeGreaterThan(0.2);
    expect(fq.length / FACT_QUIZ.length).toBeLessThan(0.32);
    expect(fq.filter((q) => q.answer === 'fact').length).toBeGreaterThanOrEqual(6);
    expect(fq.filter((q) => q.answer === 'interp').length).toBeGreaterThanOrEqual(6);
    const ft = GLOSSARY.filter(isFreeTerm);
    expect(ft.length / GLOSSARY.length).toBeGreaterThan(0.2);
    expect(ft.length / GLOSSARY.length).toBeLessThan(0.32);
    // どのグループにも無料の用語がある
    for (const g of GLOSSARY_GROUPS) expect(ft.some((x) => x.group === g), g).toBe(true);
  });
  it("today's scenario stays inside the free plan when not subscribed", async () => {
    const { isFreeScenario } = await import('./premium');
    for (let d = 1; d <= 30; d++) {
      expect(isFreeScenario(todaysScenario([], new Date(2026, 10, d), isFreeScenario))).toBe(true);
    }
  });
});
