import { useState } from 'react';
import { categoryById } from '../data/categories';
import { scenarioById } from '../data/scenarios';
import { t } from '../i18n';
import type { Lang, RecordEntry } from '../types';

interface Props {
  lang: Lang;
  records: RecordEntry[];
  onDelete: (id: string) => void;
}

const grade = (s: number) => (s >= 80 ? 'good' : s >= 50 ? 'mid' : 'low');

export function History({ lang, records, onDelete }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (records.length === 0) return <div className="empty">{t(lang, 'noRecords')}</div>;

  return (
    <>
      {records.map((r) => {
        const c = categoryById(r.category);
        const sc = r.scenarioId ? scenarioById(r.scenarioId) : undefined;
        const open = openId === r.id;
        return (
          <div key={r.id}>
            <button className="list-item" onClick={() => setOpenId(open ? null : r.id)}>
              <span className="ico">{c.icon}</span>
              <div className="body">
                <b>{sc?.title ?? (lang === 'my' ? c.nameMy : c.name)}</b>
                <div className="meta">
                  <span className="badge">{r.mode === 'scenario' ? t(lang, 'mode_scenario') : t(lang, 'mode_free')}</span>
                  {r.resident} ・ {new Date(r.createdAt).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              </div>
              {r.score !== undefined && <div className={`score-pill ${grade(r.score)}`}>{r.score}</div>}
            </button>
            {open && (
              <div className="card" style={{ marginTop: -4 }}>
                <dl className="model">
                  {c.fields.filter((f) => r.fields[f.id]).map((f) => (
                    <div key={f.id} style={{ fontSize: 13 }}>
                      <b>{f.label}</b>: {r.fields[f.id]}{f.unit ?? ''}
                    </div>
                  ))}
                  <dt>S</dt><dd>{r.soap.s || '—'}</dd>
                  <dt>O</dt><dd>{r.soap.o || '—'}</dd>
                  <dt>A</dt><dd>{r.soap.a || '—'}</dd>
                  <dt>P</dt><dd>{r.soap.p || '—'}</dd>
                </dl>
                <button
                  className="btn ghost small"
                  style={{ marginTop: 8, color: 'var(--error)' }}
                  onClick={() => { if (confirm(t(lang, 'confirmDelete'))) onDelete(r.id); }}
                >
                  🗑 {t(lang, 'delete')}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
