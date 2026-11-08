import { CATEGORIES } from '../data/categories';
import { FACT_QUIZ } from '../data/factQuiz';
import { GLOSSARY } from '../data/glossary';
import { LESSONS } from '../data/lessons';
import { SCENARIOS } from '../data/scenarios';
import { JA } from '../i18n';

/** 翻訳表（translations/myanmar.csv）に載せる行：[key, 種類, 日本語] */
export function sourceRows(): [key: string, kind: string, ja: string][] {
  const rows: [string, string, string][] = [];
  for (const [k, v] of Object.entries(JA)) rows.push([`ui.${k}`, '画面の文字', v]);
  for (const c of CATEGORIES) rows.push([`category.${c.id}`, '記録の種類', c.name]);
  for (const l of LESSONS) rows.push([`lesson.${l.id}.title`, '学ぶ（見出し）', l.title]);
  for (const s of SCENARIOS) {
    rows.push([`scenario.${s.id}.story`, '場面（あらすじ）', s.story]);
    rows.push([`scenario.${s.id}.explanation`, '場面（解説）', s.explanation]);
  }
  for (const q of FACT_QUIZ) rows.push([`quiz.${q.id}.why`, 'クイズ（解説）', `${q.text}\n→ ${q.why}`]);
  for (const g of GLOSSARY) rows.push([`glossary.${g.term}`, '用語辞典', `${g.term}（${g.yomi}）：${g.meaning}`]);
  return rows;
}
