import { CATEGORIES, categoryById } from '../data/categories';
import { SCENARIOS } from '../data/scenarios';
import type { CategoryId, FindingCode, QuizResult, RecordEntry, Scenario } from '../types';
import { checkSoap } from './checker';

/** 合格ライン。これ以上の点を取った場面を「できた」とする */
export const MASTERY = 80;

/** 端末の日付で YYYY-MM-DD（タイムゾーンをずらさない） */
export const dayKey = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** 学習した日の集合（記録の保存かクイズを1回やった日） */
export function activeDays(records: RecordEntry[], quizzes: QuizResult[]): Set<string> {
  return new Set([...records.map((r) => dayKey(r.createdAt)), ...quizzes.map((q) => dayKey(q.createdAt))]);
}

/**
 * 連続学習日数。今日まだ学習していなくても、昨日まで続いていれば途切れていない扱いにする
 * （朝に開いた時点で「0日」と出るとやる気が下がるため）。
 */
export function streak(days: Set<string>, today = new Date()): { count: number; doneToday: boolean } {
  const doneToday = days.has(dayKey(today));
  let d = doneToday ? today : addDays(today, -1);
  let count = 0;
  while (days.has(dayKey(d))) {
    count++;
    d = addDays(d, -1);
  }
  return { count, doneToday };
}

/** 直近7日（古い順）の学習の有無 */
export function lastWeek(days: Set<string>, today = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 6);
    return { key: dayKey(d), label: '日月火水木金土'[d.getDay()], done: days.has(dayKey(d)) };
  });
}

export function bestScores(records: RecordEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of records) {
    if (!r.scenarioId || r.score === undefined) continue;
    m.set(r.scenarioId, Math.max(m.get(r.scenarioId) ?? 0, r.score));
  }
  return m;
}

export function categoryProgress(records: RecordEntry[]) {
  const best = bestScores(records);
  return CATEGORIES.map((c) => {
    const list = SCENARIOS.filter((s) => s.category === c.id);
    const mastered = list.filter((s) => (best.get(s.id) ?? 0) >= MASTERY).length;
    return { category: c, total: list.length, mastered };
  }).filter((x) => x.total > 0);
}

/** 今日の場面：まだできていない場面から、日付で決まる1本（同じ日は同じ場面） */
export function todaysScenario(records: RecordEntry[], today = new Date()): Scenario {
  const best = bestScores(records);
  const pool = SCENARIOS.filter((s) => (best.get(s.id) ?? 0) < MASTERY);
  const list = pool.length ? pool : SCENARIOS;
  const seed = Number(dayKey(today).replace(/-/g, ''));
  return list[seed % list.length];
}

/** 一度やったが合格ラインに届いていない場面（復習リスト） */
export function reviewScenarios(records: RecordEntry[]): { scenario: Scenario; best: number }[] {
  const best = bestScores(records);
  return SCENARIOS.filter((s) => best.has(s.id) && best.get(s.id)! < MASTERY)
    .map((s) => ({ scenario: s, best: best.get(s.id)! }))
    .sort((a, b) => a.best - b.best);
}

export const WEAK_LABELS: Partial<Record<FindingCode, { label: string; tip: string }>> = {
  speculation: { label: '推測を O に書いている', tip: '「〜と思う」「〜そう」は A へ。O は見た・聞いた・測ったことだけ。' },
  feeling: { label: '職員の感情を書いている', tip: '「かわいそう」「心配」は書かない。利用者の様子を書く。' },
  vague: { label: 'あいまいな量・程度', tip: '「少し」「たくさん」ではなく、ml・割・回・cm で。' },
  label: { label: 'ラベル・尊厳を傷つける言葉', tip: '「徘徊」「不穏」ではなく、見た行動と言葉をそのまま。' },
  's-quote': { label: '本人の言葉に「」がない', tip: 'S は本人の言葉を「」で、言ったとおりに。' },
  time: { label: '時刻がない', tip: 'O の最初に「7:30」のように時刻を。' },
  number: { label: '数字がない', tip: '量・回数・測定値は数字で。' },
  report: { label: '報告先がない', tip: 'いつもと違うときは「誰に報告したか」まで書く。' },
  a: { label: 'A（判断）が弱い', tip: '「〜の可能性がある」「〜と考えられる」と書く。' },
  p: { label: 'P（計画）が弱い', tip: '「〜を観察する」「〜に報告する」と行動で書く。' },
};

/** 最近の記録から、よく指摘される書き方のくせを数える */
export function weakPoints(records: RecordEntry[], recent = 15) {
  const counts = new Map<FindingCode, number>();
  for (const r of records.slice(0, recent)) {
    const seen = new Set<FindingCode>();
    for (const f of checkSoap(r.soap, categoryById(r.category as CategoryId))) {
      if (f.code && (f.severity === 'error' || f.severity === 'warn') && WEAK_LABELS[f.code]) seen.add(f.code);
    }
    seen.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code, n]) => ({ code, n, ...WEAK_LABELS[code]! }));
}

export function quizStats(quizzes: QuizResult[]) {
  const total = quizzes.reduce((s, q) => s + q.total, 0);
  const correct = quizzes.reduce((s, q) => s + q.correct, 0);
  return { rounds: quizzes.length, total, correct, rate: total ? Math.round((correct / total) * 100) : 0 };
}

/** 間違えたあと、まだ正解し直していない問題（古い結果から順に反映する） */
export function missedQuizIds(quizzes: QuizResult[]): string[] {
  const wrong = new Set<string>();
  for (const q of [...quizzes].reverse()) {
    q.askedIds.forEach((id) => wrong.delete(id));
    q.wrongIds.forEach((id) => wrong.add(id));
  }
  return [...wrong];
}
