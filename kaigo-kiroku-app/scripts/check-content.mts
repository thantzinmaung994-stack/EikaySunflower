/**
 * 講師が書いた問題（content/*.csv）を確かめる。
 *   npm run content:check
 * 読み込めない行の理由と、場面の模範解答の点数（85点以上で合格）を表示する。
 */
import { categoryById } from '../src/data/categories';
import { CSV_QUIZ } from '../src/data/factQuiz';
import { CSV_GLOSSARY } from '../src/data/glossary';
import { CSV_SCENARIOS } from '../src/data/scenarios';
import { evaluate } from '../src/lib/checker';
import { CONTENT_ERRORS } from '../src/lib/contentCsv';

let ng = CONTENT_ERRORS.length;
for (const e of CONTENT_ERRORS) console.log(`✕ content/${e.file} ${e.row}行目：${e.message}`);

for (const s of CSV_SCENARIOS) {
  const fields = Object.fromEntries(Object.entries(s.expected).map(([k, v]) => [k, String(v.value)]));
  const r = evaluate({ id: 'check', createdAt: '', mode: 'scenario', scenarioId: s.id, category: s.category, resident: s.resident, fields, w: s.model.w, soap: s.model.soap }, s, categoryById(s.category));
  const missed = r.keyPointHits.filter((k) => !k.hit).map((k) => k.label);
  const bad = r.findings.filter((f) => f.severity === 'error' || f.severity === 'warn');
  const ok = r.score >= 85 && missed.length === 0 && bad.length === 0;
  if (!ok) ng++;
  console.log(`${ok ? '○' : '✕'} 場面 ${s.id}「${s.title}」模範解答 ${r.score}点`);
  for (const m of missed) console.log(`    ・模範解答に「${m}」の語が入っていません（書くべき要点の語を見直す）`);
  for (const f of bad) console.log(`    ・模範解答の ${f.part}：${f.match ? `「${f.match}」` : ''}${f.message.replace(/「[^」]*」は/, 'は')}`);
}
console.log(`\n読み込み：場面 ${CSV_SCENARIOS.length}本・クイズ ${CSV_QUIZ.length}問・用語 ${CSV_GLOSSARY.length}語`);
console.log(ng ? `直すところが ${ng} 件あります。` : '問題ありません。');
process.exit(ng ? 1 : 0);
