/**
 * 講師が表計算ソフトで作った問題（content/*.csv）をアプリのデータに変換する。
 * 書き方は content/README.md。おかしな行は読み込まずに errors に理由を入れる（アプリは止めない）。
 */
import { CATEGORIES } from '../data/categories';
import type { FactItem } from '../data/factQuiz';
import type { GlossaryGroup, GlossaryTerm } from '../data/glossary';
import type { CategoryDef, ExpectedField, KeyPoint, Scenario } from '../types';
import { parseCsv } from './csv';

export interface ContentError {
  file: string;
  /** 表計算ソフトでの行番号（見出しが1行目） */
  row: number;
  message: string;
}

/** 読み込めなかった行（npm run content:check とテストで表示する） */
export const CONTENT_ERRORS: ContentError[] = [];

type Row = Record<string, string>;

/** 見出し行をキーにした行の配列。公開列に何か入っている行だけを返す */
function table(text: string, file: string, required: string[], errors: ContentError[]): { row: number; r: Row }[] {
  const [header = [], ...rows] = parseCsv(text);
  const h = header.map((x) => x.trim());
  for (const col of required) {
    if (!h.includes(col)) errors.push({ file, row: 1, message: `見出しに「${col}」の列がありません` });
  }
  return rows
    .map((cells, i) => ({ row: i + 2, r: Object.fromEntries(h.map((k, j) => [k, (cells[j] ?? '').trim()])) as Row }))
    .filter(({ r }) => Object.values(r).some(Boolean) && r['公開'] && !/^(×|x|no|いいえ|非公開)$/i.test(r['公開']));
}

const toHalf = (s: string) => s.replace(/[０-９．：＋－±]/g, (c) => (c === '±' ? c : String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
const lines = (s: string) => s.split(/\r?\n|；|;/).map((x) => x.trim()).filter(Boolean);
const words = (s: string) => s.split(/[、,，/／・]/).map((x) => x.trim()).filter(Boolean);

function findCategory(v: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === v || c.name === v || c.name.startsWith(v));
}

const PARTS = ['S', 'O', 'A', 'P'] as const;

export function parseScenarios(text: string, builtinIds: Set<string>, errors: ContentError[]): Scenario[] {
  const file = 'scenarios.csv';
  const out: Scenario[] = [];
  const seen = new Set<string>();
  const req = ['公開', 'id', '種類', 'レベル', 'タイトル', '利用者', '場面', '正解の記録項目', '書くべき要点', 'いつ', 'どこで', '誰が', '何を', 'なぜ', 'どのように', 'S', 'O', 'A', 'P', '解説'];
  for (const { row, r } of table(text, file, req, errors)) {
    const err = (message: string) => errors.push({ file, row, message });
    const before = errors.length;
    const id = r['id'];
    if (!/^[a-z0-9-]+$/.test(id)) err('id は半角の英小文字・数字・ハイフンで（例：vital-k01）');
    else if (builtinIds.has(id) || seen.has(id)) err(`id「${id}」はすでに使われています`);
    else if (/-0[1-3]$/.test(id)) err('id の最後が「-01」〜「-03」だと無料の場面になってしまいます。「-k01」のようにしてください');
    seen.add(id);
    const cat = findCategory(r['種類']);
    if (!cat) err(`種類「${r['種類']}」がありません。使えるのは：${CATEGORIES.map((c) => c.name).join('／')}`);
    const level = Number(toHalf(r['レベル']));
    if (![1, 2, 3].includes(level)) err('レベルは 1・2・3 のどれか');
    for (const col of ['タイトル', '利用者', '場面', 'O', '解説']) if (!r[col]) err(`「${col}」が空です`);

    // 正解の記録項目：「体温=37.8」「所要時間=20±5」「食事形態=きざみ食」を1行に1つ
    const expected: Record<string, ExpectedField> = {};
    if (cat) {
      for (const line of lines(r['正解の記録項目'])) {
        const m = line.match(/^(.+?)\s*[=＝]\s*(.+)$/);
        if (!m) {
          err(`正解の記録項目「${line}」は「項目名=値」の形で`);
          continue;
        }
        const field = cat.fields.find((f) => f.label === m[1].trim() || f.id === m[1].trim());
        if (!field) {
          err(`「${cat.name}」に「${m[1]}」という項目はありません。使えるのは：${cat.fields.map((f) => f.label).join('／')}`);
          continue;
        }
        const v = m[2].trim();
        if (field.type === 'number') {
          const n = toHalf(v).match(/^(-?\d+(?:\.\d+)?)\s*(?:±\s*(\d+(?:\.\d+)?))?$/);
          if (!n) err(`「${field.label}」は数字で（例：37.8、20±5）`);
          else expected[field.id] = { value: Number(n[1]), ...(n[2] ? { tolerance: Number(n[2]) } : {}) };
        } else if (field.type === 'select') {
          if (!field.options!.includes(v)) err(`「${field.label}」の値「${v}」は選べません。選べるのは：${field.options!.join('／')}`);
          else expected[field.id] = { value: v };
        } else if (field.type === 'time') {
          const t = toHalf(v).match(/^(\d{1,2}):(\d{2})$/);
          if (!t) err(`「${field.label}」は 7:30 のように`);
          else expected[field.id] = { value: `${t[1].padStart(2, '0')}:${t[2]}` };
        } else {
          err(`「${field.label}」は自由に書く欄なので、正解にはできません`);
        }
      }
    }

    // 書くべき要点：「体温37.8℃｜37.8｜O」を1行に1つ（表示名｜文章に入っているべき語（、で区切る）｜S/O/A/P）
    const keyPoints: KeyPoint[] = [];
    for (const line of lines(r['書くべき要点'])) {
      const [label, any = '', part = ''] = line.split(/[|｜]/).map((x) => x.trim());
      const p = toHalf(part).toUpperCase();
      if (!label || !any) {
        err(`書くべき要点「${line}」は「表示名｜語1、語2｜O」の形で`);
        continue;
      }
      if (p && !(PARTS as readonly string[]).includes(p)) err(`書くべき要点「${line}」の最後は S・O・A・P のどれか`);
      keyPoints.push({ label, any: words(any), ...(p ? { part: p as KeyPoint['part'] } : {}) });
    }
    if (keyPoints.length < 2) err('書くべき要点は2つ以上');

    if (errors.length > before || !cat) continue;
    out.push({
      id,
      category: cat.id,
      title: r['タイトル'],
      level: level as 1 | 2 | 3,
      resident: r['利用者'],
      story: r['場面'],
      expected,
      keyPoints,
      model: {
        w: { when: r['いつ'], where: r['どこで'], who: r['誰が'], what: r['何を'], why: r['なぜ'], how: r['どのように'] },
        soap: { s: r['S'], o: r['O'], a: r['A'], p: r['P'] },
      },
      explanation: r['解説'],
    });
  }
  return out;
}

export function parseQuiz(text: string, builtinIds: Set<string>, errors: ContentError[]): FactItem[] {
  const file = 'quiz.csv';
  const out: FactItem[] = [];
  const seen = new Set<string>();
  for (const { row, r } of table(text, file, ['公開', 'id', '記録の文', '答え', '解説', '書き直し例'], errors)) {
    const err = (message: string) => errors.push({ file, row, message });
    const before = errors.length;
    const id = r['id'];
    if (!/^[a-z0-9-]+$/.test(id)) err('id は半角の英小文字・数字・ハイフンで（例：k01）');
    else if (builtinIds.has(id) || seen.has(id)) err(`id「${id}」はすでに使われています`);
    seen.add(id);
    const answer = r['答え'] === '事実' ? 'fact' : r['答え'] === '解釈' ? 'interp' : null;
    if (!answer) err('答えは「事実」か「解釈」');
    if (!r['記録の文']) err('「記録の文」が空です');
    if (!r['解説']) err('「解説」が空です');
    if (answer === 'interp' && !r['書き直し例']) err('答えが「解釈」のときは「書き直し例」（事実で書いた文）を入れてください');
    if (errors.length > before || !answer) continue;
    out.push({ id, text: r['記録の文'], answer, why: r['解説'], ...(r['書き直し例'] ? { better: r['書き直し例'] } : {}) });
  }
  return out;
}

export function parseGlossary(text: string, builtinTerms: Set<string>, groups: readonly GlossaryGroup[], errors: ContentError[]): GlossaryTerm[] {
  const file = 'glossary.csv';
  const out: GlossaryTerm[] = [];
  const seen = new Set<string>();
  for (const { row, r } of table(text, file, ['公開', '用語', '読み', 'グループ', '意味', '記録での例'], errors)) {
    const err = (message: string) => errors.push({ file, row, message });
    const before = errors.length;
    const term = r['用語'];
    if (!term) err('「用語」が空です');
    else if (builtinTerms.has(term) || seen.has(term)) err(`「${term}」はすでに用語辞典にあります`);
    seen.add(term);
    if (!/^[ぁ-ゟ゠-ヿー]+$/.test(r['読み'])) err('読みは、ひらがなかカタカナで');
    if (!groups.includes(r['グループ'] as GlossaryGroup)) err(`グループは次のどれか：${groups.join('／')}`);
    if (!r['意味']) err('「意味」が空です');
    if (errors.length > before) continue;
    out.push({ term, yomi: r['読み'], group: r['グループ'] as GlossaryGroup, meaning: r['意味'], ...(r['記録での例'] ? { example: r['記録での例'] } : {}) });
  }
  return out;
}
