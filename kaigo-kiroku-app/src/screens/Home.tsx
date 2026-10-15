import { CATEGORIES } from '../data/categories';
import { SCENARIOS } from '../data/scenarios';
import { t } from '../i18n';
import type { CategoryId, Lang, RecordEntry } from '../types';

interface Props {
  lang: Lang;
  records: RecordEntry[];
  onPractice: () => void;
  onFree: (cat?: CategoryId) => void;
}

const grade = (s: number) => (s >= 80 ? 'good' : s >= 50 ? 'mid' : 'low');

export function Home({ lang, records, onPractice, onFree }: Props) {
  const scored = records.filter((r) => r.score !== undefined).slice(0, 5);
  return (
    <>
      <div className="card hero">
        <h1>{t(lang, 'heroTitle')}</h1>
        <p>{t(lang, 'heroSub')}</p>
        <button className="btn" onClick={onPractice}>📖 {t(lang, 'startPractice')}</button>
        <button className="btn secondary" style={{ marginTop: 8, background: '#fff' }} onClick={() => onFree()}>✏️ {t(lang, 'freeRecord')}</button>
        <div className="muted" style={{ marginTop: 8 }}>{SCENARIOS.length} {t(lang, 'scenarioCount')}</div>
      </div>

      <div className="card">
        <h2>{t(lang, 'categories')}</h2>
        <div className="cat-grid">
          {CATEGORIES.map((c) => (
            <button key={c.id} className="cat-tile" onClick={() => onFree(c.id)}>
              <span className="ico">{c.icon}</span>
              {lang === 'my' ? c.nameMy : c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>{t(lang, 'recentScores')}</h2>
        {scored.length === 0 ? (
          <div className="muted">{t(lang, 'noRecords')}</div>
        ) : (
          scored.map((r) => {
            const sc = SCENARIOS.find((s) => s.id === r.scenarioId);
            return (
              <div key={r.id} className="list-item" style={{ marginBottom: 6 }}>
                <div className="body">
                  <b>{sc?.title ?? r.resident}</b>
                  <div className="meta">{new Date(r.createdAt).toLocaleDateString('ja-JP')}</div>
                </div>
                <div className={`score-pill ${grade(r.score!)}`}>{r.score}</div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
