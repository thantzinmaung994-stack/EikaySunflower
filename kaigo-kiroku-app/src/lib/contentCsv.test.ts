import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { categoryById } from '../data/categories';
import { GLOSSARY_GROUPS } from '../data/glossary';
import { evaluate } from './checker';
import { CONTENT_ERRORS, parseGlossary, parseQuiz, parseScenarios, type ContentError } from './contentCsv';

// 記入例の行（公開が空）を「○」にして読み込む
const publish = (file: string) => readFileSync(`content/${file}`, 'utf8').replace(/\r\n,/g, '\r\n○,');

describe('content/*.csv', () => {
  it('the files currently in the repo load without errors (run `npm run content:check` for details)', () => {
    expect(CONTENT_ERRORS).toEqual([]);
  });

  it('the example scenario is valid and its model answer passes the checker', () => {
    const errors: ContentError[] = [];
    const [s] = parseScenarios(publish('scenarios.csv'), new Set(), errors);
    expect(errors).toEqual([]);
    expect(s.category).toBe('excretion');
    expect(s.expected.urine).toEqual({ value: 150 });
    const fields = Object.fromEntries(Object.entries(s.expected).map(([k, v]) => [k, String(v.value)]));
    const r = evaluate({ id: 'x', createdAt: '', mode: 'scenario', scenarioId: s.id, category: s.category, resident: '', fields, w: s.model.w, soap: s.model.soap }, s, categoryById(s.category));
    expect(r.keyPointHits.filter((k) => !k.hit)).toEqual([]);
    expect(r.score).toBeGreaterThanOrEqual(85);
  });

  it('the example quiz item and term are valid', () => {
    const errors: ContentError[] = [];
    expect(parseQuiz(publish('quiz.csv'), new Set(), errors)).toHaveLength(1);
    expect(parseGlossary(publish('glossary.csv'), new Set(), GLOSSARY_GROUPS, errors)).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  it('skips rows that are not published', () => {
    const errors: ContentError[] = [];
    expect(parseQuiz(readFileSync('content/quiz.csv', 'utf8'), new Set(), errors)).toEqual([]);
  });

  it('reports mistakes in plain Japanese and skips the row', () => {
    const errors: ContentError[] = [];
    const csv =
      '公開,id,記録の文,答え,解説,書き直し例\n' +
      '○,f01,文,事実,解説,\n' + // 組み込みと同じ id
      '○,k02,文,たぶん,解説,\n' + // 答えがおかしい
      '○,k03,推測の文,解釈,解説,\n'; // 書き直し例がない
    expect(parseQuiz(csv, new Set(['f01']), errors)).toEqual([]);
    expect(errors.map((e) => [e.row, e.message])).toEqual([
      [2, 'id「f01」はすでに使われています'],
      [3, '答えは「事実」か「解釈」'],
      [4, '答えが「解釈」のときは「書き直し例」（事実で書いた文）を入れてください'],
    ]);
  });

  it('explains wrong field names and select values', () => {
    const errors: ContentError[] = [];
    const head = '公開,id,種類,レベル,タイトル,利用者,場面,正解の記録項目,書くべき要点,いつ,どこで,誰が,何を,なぜ,どのように,S,O,A,P,解説\n';
    parseScenarios(head + '○,meal-k01,食事・水分,2,t,u,s,"体重=50\n食事形態=刻み","a｜a｜O\nb｜b｜O",,,,,,,,o,,,e\n', new Set(), errors);
    expect(errors.map((e) => e.message)).toEqual([
      expect.stringContaining('「体重」という項目はありません'),
      expect.stringContaining('「食事形態」の値「刻み」は選べません'),
    ]);
  });
});

describe('glossary data', () => {
  it('every term has a known group, a kana reading and is unique', async () => {
    const { GLOSSARY, GLOSSARY_GROUPS } = await import('../data/glossary');
    const groups = new Set<string>(GLOSSARY_GROUPS);
    const bad = GLOSSARY.filter((g) => !groups.has(g.group) || !/^[ぁ-ゟ゠-ヿー・]+$/.test(g.yomi) || !g.meaning);
    expect(bad.map((g) => g.term)).toEqual([]);
    const terms = GLOSSARY.map((g) => g.term);
    expect(new Set(terms).size).toBe(terms.length);
  });
});
