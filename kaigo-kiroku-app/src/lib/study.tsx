/**
 * 用語カード（間隔反復）とお気に入り。
 * - カードは「箱」0〜6 に入る。覚えたら次の箱へ進み、次に出す日が延びる。まだなら箱1に戻る。
 * - 端末の中に保存（kaigo-kiroku:cards / kaigo-kiroku:favorites）。
 */
import { createContext, useContext } from 'react';
import { dayKey } from './progress';

/** 箱ごとに、次に出すまでの日数 */
export const INTERVALS = [0, 1, 2, 4, 7, 15, 30];
/** この箱以上を「覚えた」とする */
export const LEARNED_BOX = 3;

export interface CardState {
  box: number;
  /** 次に出す日（YYYY-MM-DD） */
  due: string;
  /** 「まだ」を押した回数（苦手な語を見つけるため） */
  misses: number;
}

export type Cards = Record<string, CardState>;

const addDays = (n: number, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

/** 答えたあとのカードの状態 */
export function review(prev: CardState | undefined, knew: boolean, today = new Date()): CardState {
  if (!knew) return { box: 1, due: addDays(INTERVALS[1], today), misses: (prev?.misses ?? 0) + 1 };
  const box = Math.min((prev?.box ?? 0) + 1, INTERVALS.length - 1);
  return { box, due: addDays(INTERVALS[box], today), misses: prev?.misses ?? 0 };
}

/**
 * 今日のカードの順番：期限が来たもの（古い順）→ まだ出していないもの。
 * pool は出してよい語（無料プランなら無料の語だけ）。
 */
export function todaysDeck(pool: string[], cards: Cards, size = 20, today = new Date()): string[] {
  const t = dayKey(today);
  const due = pool.filter((k) => cards[k] && cards[k].due <= t).sort((a, b) => cards[a].due.localeCompare(cards[b].due));
  const fresh = pool.filter((k) => !cards[k]);
  return [...due, ...fresh].slice(0, size);
}

export function deckStats(pool: string[], cards: Cards, today = new Date()) {
  const t = dayKey(today);
  let learned = 0;
  let due = 0;
  let seen = 0;
  for (const k of pool) {
    const c = cards[k];
    if (!c) continue;
    seen++;
    if (c.box >= LEARNED_BOX) learned++;
    if (c.due <= t) due++;
  }
  return { total: pool.length, seen, learned, due };
}

export interface Study {
  cards: Cards;
  favorites: Set<string>;
  answerCard: (term: string, knew: boolean) => void;
  toggleFavorite: (term: string) => void;
}

export const StudyContext = createContext<Study>({ cards: {}, favorites: new Set(), answerCard: () => {}, toggleFavorite: () => {} });
export const useStudy = () => useContext(StudyContext);
