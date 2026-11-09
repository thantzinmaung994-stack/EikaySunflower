import { t } from '../i18n';
import { activeDays, dayKey } from '../lib/progress';
import type { Lang, QuizResult, RecordEntry } from '../types';

interface Props {
  lang: Lang;
  records: RecordEntry[];
  quizzes: QuizResult[];
}

const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // 月曜はじまり
  return x;
};

/** 週ごとの数字（今週・先週） */
export function weekSummary(records: RecordEntry[], quizzes: QuizResult[], weeksAgo: number, today = new Date()) {
  const from = startOfWeek(today);
  from.setDate(from.getDate() - 7 * weeksAgo);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  const inWeek = (iso: string) => {
    const d = new Date(iso);
    return d >= from && d < to;
  };
  const recs = records.filter((r) => inWeek(r.createdAt));
  const qs = quizzes.filter((q) => inWeek(q.createdAt));
  const scored = recs.filter((r) => r.score !== undefined);
  const days = [...activeDays(recs, qs)].length;
  const total = qs.reduce((s, q) => s + q.total, 0);
  return {
    days,
    scenes: recs.length,
    avg: scored.length ? Math.round(scored.reduce((s, r) => s + r.score!, 0) / scored.length) : null,
    quizRate: total ? Math.round((qs.reduce((s, q) => s + q.correct, 0) / total) * 100) : null,
  };
}

/** 点数の推移（直近20回）。80点の線を引く */
function Trend({ scores }: { scores: number[] }) {
  const W = 300;
  const H = 110;
  const pad = { l: 26, r: 8, t: 8, b: 18 };
  const x = (i: number) => pad.l + (scores.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (scores.length - 1));
  const y = (v: number) => pad.t + ((100 - v) * (H - pad.t - pad.b)) / 100;
  const line = scores.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(scores.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  return (
    <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`点数の推移：${scores.join('、')}点`}>
      {[0, 50, 80, 100].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className={v === 80 ? 'goal-line' : 'grid'} />
          <text x={pad.l - 4} y={y(v) + 3} className="axis" textAnchor="end">{v}</text>
        </g>
      ))}
      <path d={area} className="area" />
      <path d={line} className="line" />
      {scores.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === scores.length - 1 ? 4 : 2.5} className={i === scores.length - 1 ? 'dot last' : 'dot'} />
      ))}
    </svg>
  );
}

export function StatsPanel({ lang, records, quizzes }: Props) {
  const scores = records
    .filter((r) => r.score !== undefined)
    .slice(0, 20)
    .map((r) => r.score!)
    .reverse();
  const now = weekSummary(records, quizzes, 0);
  const prev = weekSummary(records, quizzes, 1);
  const rows: [string, number | null, number | null, string][] = [
    [t(lang, 'statDays'), now.days, prev.days, t(lang, 'dayUnit')],
    [t(lang, 'statScenes'), now.scenes, prev.scenes, t(lang, 'scenesUnit')],
    [t(lang, 'statAvg'), now.avg, prev.avg, t(lang, 'score')],
    [t(lang, 'statQuiz'), now.quizRate, prev.quizRate, '%'],
  ];
  const fmt = (v: number | null, u: string) => (v === null ? '—' : `${v}${u}`);
  const diff = (a: number | null, b: number | null) => (a === null || b === null || a === b ? '' : a > b ? `▲${a - b}` : `▼${b - a}`);

  return (
    <div className="card">
      <h2>📈 {t(lang, 'statsTitle')}</h2>
      {scores.length > 0 ? <Trend scores={scores} /> : <div className="muted">{t(lang, 'statsEmpty')}</div>}
      <table className="week-table">
        <thead>
          <tr><th /><th>{t(lang, 'thisWeek')}</th><th>{t(lang, 'lastWeek')}</th><th /></tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b, u]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{fmt(a, u)}</td>
              <td className="muted">{fmt(b, u)}</td>
              <td className={`delta${(a ?? 0) >= (b ?? 0) ? ' up' : ' down'}`}>{diff(a, b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="muted" style={{ marginTop: 4 }}>{t(lang, 'weekNote').replace('{d}', dayKey(startOfWeek(new Date())).slice(5).replace('-', '/'))}</div>
    </div>
  );
}
