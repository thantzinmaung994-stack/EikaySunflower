import { useState } from 'react';
import { CATEGORIES, categoryById } from '../data/categories';
import { SCENARIOS } from '../data/scenarios';
import { t } from '../i18n';
import type { CategoryId, Lang, RecordEntry } from '../types';

interface Props {
  lang: Lang;
  records: RecordEntry[];
  onSelect: (id: string) => void;
}

const grade = (s: number) => (s >= 80 ? 'good' : s >= 50 ? 'mid' : 'low');

export function PracticeList({ lang, records, onSelect }: Props) {
  const [filter, setFilter] = useState<CategoryId | 'all'>('all');
  const list = SCENARIOS.filter((s) => filter === 'all' || s.category === filter);
  const best = (id: string) =>
    records.filter((r) => r.scenarioId === id && r.score !== undefined).reduce<number | undefined>((m, r) => (m === undefined || r.score! > m ? r.score : m), undefined);

  return (
    <>
      <div className="card">
        <h2>{t(lang, 'tabPractice')}</h2>
        <div className="cat-grid">
          <button className={`cat-tile${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
            <span className="ico">📚</span>ALL
          </button>
          {CATEGORIES.filter((c) => SCENARIOS.some((s) => s.category === c.id)).map((c) => (
            <button key={c.id} className={`cat-tile${filter === c.id ? ' active' : ''}`} onClick={() => setFilter(c.id)}>
              <span className="ico">{c.icon}</span>
              {lang === 'my' ? c.nameMy : c.name}
            </button>
          ))}
        </div>
      </div>

      {list.map((s) => {
        const c = categoryById(s.category);
        const b = best(s.id);
        return (
          <button key={s.id} className="list-item" onClick={() => onSelect(s.id)}>
            <span className="ico">{c.icon}</span>
            <div className="body">
              <b>{s.title}</b>
              <div className="meta">
                <span className={`badge lv${s.level}`}>{t(lang, 'level')} {s.level}</span>
                {s.resident}
              </div>
            </div>
            {b !== undefined ? <div className={`score-pill ${grade(b)}`}>{b}</div> : <div className="score-pill muted">›</div>}
          </button>
        );
      })}
    </>
  );
}
