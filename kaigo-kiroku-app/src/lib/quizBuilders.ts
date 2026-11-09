/**
 * 選択式クイズの問題を作る。
 * - SOAP どれ？：src/data/soapQuiz.ts
 * - どう書き直す？：src/data/rephraseQuiz.ts
 * - 5W1H どれ？：場面の模範解答の 5W1H から自動で作る
 * - 用語クイズ：用語辞典から自動で作る（意味→用語、漢字→読み）
 * 無料プランはそれぞれ約25%の範囲から出す。
 */
import type { ChoiceItem } from '../components/ChoiceQuiz';
import { GLOSSARY, type GlossaryTerm } from '../data/glossary';
import { REPHRASE_QUIZ } from '../data/rephraseQuiz';
import { SCENARIOS } from '../data/scenarios';
import { SOAP_QUIZ } from '../data/soapQuiz';
import type { FiveW1H } from '../types';
import { my } from './myanmar';
import { isFreeScenario, isFreeTerm } from './premium';

export function shuffle<T>(a: readonly T[], rand = Math.random): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

/** 答えの種類ごとに4問に1問を無料にする（無料でも偏らない） */
function freeQuarter<T extends { id: string }>(items: readonly T[], key: (x: T) => string): Set<string> {
  const groups = new Map<string, T[]>();
  for (const x of items) groups.set(key(x), [...(groups.get(key(x)) ?? []), x]);
  return new Set([...groups.values()].flatMap((g) => g.filter((_, i) => i % 4 === 0).map((x) => x.id)));
}

// ---- SOAP どれ？ ----
const SOAP_LABEL = { S: 'S（本人の言葉）', O: 'O（見た・測った事実）', A: 'A（判断）', P: 'P（計画）' } as const;
const SOAP_KEYS = ['S', 'O', 'A', 'P'] as const;
const FREE_SOAP = freeQuarter(SOAP_QUIZ, (x) => x.answer);

export function soapPool(premium: boolean) {
  return premium ? SOAP_QUIZ : SOAP_QUIZ.filter((x) => FREE_SOAP.has(x.id));
}
export function buildSoap(premium: boolean, n = 10): ChoiceItem[] {
  return shuffle(soapPool(premium))
    .slice(0, n)
    .map((x) => ({ id: x.id, prompt: x.text, choices: SOAP_KEYS.map((k) => SOAP_LABEL[k]), answer: SOAP_KEYS.indexOf(x.answer), why: x.why }));
}

// ---- どう書き直す？ ----
const FREE_REPHRASE = freeQuarter(REPHRASE_QUIZ, (x) => x.point);
export function rephrasePool(premium: boolean) {
  return premium ? REPHRASE_QUIZ : REPHRASE_QUIZ.filter((x) => FREE_REPHRASE.has(x.id));
}
export function buildRephrase(premium: boolean, n = 8): ChoiceItem[] {
  return shuffle(rephrasePool(premium))
    .slice(0, n)
    .map((x) => {
      // 選択肢の順番も毎回入れかえる
      const order = shuffle([0, 1, 2, 3]);
      return { id: x.id, prompt: x.bad, choices: order.map((i) => x.choices[i]), answer: order.indexOf(x.answer), why: x.why };
    });
}

// ---- 5W1H どれ？ ----
const W_KEYS: (keyof FiveW1H)[] = ['when', 'where', 'who', 'what', 'why', 'how'];
const W_LABEL: Record<keyof FiveW1H, string> = { when: 'いつ（When）', where: 'どこで（Where）', who: '誰が（Who）', what: '何を（What）', why: 'なぜ（Why）', how: 'どのように（How）' };

interface WItem { id: string; scenarioTitle: string; key: keyof FiveW1H; value: string }
/** 模範解答の 5W1H のうち、問題にできるもの（空・「—」・「（…）」だけのものは除く） */
export const W_ITEMS: WItem[] = SCENARIOS.flatMap((s) =>
  W_KEYS.filter((k) => {
    const v = s.model.w[k]?.trim() ?? '';
    return v && v !== '—' && !/^（.*）$/.test(v);
  }).map((k) => ({ id: `${s.id}:${k}`, scenarioTitle: s.title, key: k, value: s.model.w[k] })),
);

export function wPool(premium: boolean) {
  return premium ? W_ITEMS : W_ITEMS.filter((x) => isFreeScenario({ id: x.id.split(':')[0] }));
}
export function build5W1H(premium: boolean, n = 10): ChoiceItem[] {
  return shuffle(wPool(premium))
    .slice(0, n)
    .map((x) => ({
      id: x.id,
      context: `場面：${x.scenarioTitle}`,
      prompt: x.value,
      choices: W_KEYS.map((k) => W_LABEL[k]),
      answer: W_KEYS.indexOf(x.key),
      why: `「${x.value}」は、5W1Hの「${W_LABEL[x.key]}」にあたります。`,
    }));
}

// ---- 用語クイズ ----
const HAS_KANJI = /[一-鿿々]/;
export function termPool(premium: boolean): GlossaryTerm[] {
  return premium ? GLOSSARY : GLOSSARY.filter(isFreeTerm);
}

/** 同じグループから、まぎらわしい選択肢を3つ選ぶ */
function distractors(g: GlossaryTerm, pick: (x: GlossaryTerm) => string, pool: GlossaryTerm[]): string[] {
  const same = shuffle(pool.filter((x) => x.group === g.group && pick(x) !== pick(g)));
  const other = shuffle(pool.filter((x) => x.group !== g.group && pick(x) !== pick(g)));
  const out: string[] = [];
  for (const x of [...same, ...other]) {
    if (!out.includes(pick(x))) out.push(pick(x));
    if (out.length === 3) break;
  }
  return out;
}

export function buildTermQuiz(premium: boolean, n = 10, only?: Set<string>): ChoiceItem[] {
  const pool = termPool(premium);
  const asked = shuffle(only ? pool.filter((g) => only.has(g.term)) : pool).slice(0, n);
  return asked.map((g, i) => {
    // 漢字の語は半分を「読み」の問題にする
    const reading = HAS_KANJI.test(g.term) && i % 2 === 1;
    const pick = reading ? (x: GlossaryTerm) => x.yomi : (x: GlossaryTerm) => x.term;
    const right = pick(g);
    const choices = shuffle([right, ...distractors(g, pick, GLOSSARY)]);
    const myText = my(`glossary.${g.term}`);
    return {
      id: `${reading ? 'y' : 'm'}:${g.term}`,
      context: g.group,
      prompt: reading ? `「${g.term}」の読み方は？` : g.meaning,
      choices,
      answer: choices.indexOf(right),
      why: reading ? `${g.term}（${g.yomi}）：${g.meaning}` : `「${g.term}」（${g.yomi}）です。`,
      extra: myText ? `🇲🇲 ${myText}` : undefined,
    };
  });
}
