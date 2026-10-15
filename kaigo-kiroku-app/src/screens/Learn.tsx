import { LESSONS } from '../data/lessons';
import { t } from '../i18n';
import type { Lang } from '../types';

export function Learn({ lang }: { lang: Lang }) {
  return (
    <>
      <div className="card">
        <h2>{t(lang, 'learnTitle')}</h2>
        <div className="muted">介護福祉士国家試験「コミュニケーション技術」「介護過程」の出題範囲に対応</div>
      </div>
      {LESSONS.map((l) => (
        <div className="card" key={l.id}>
          <details open={l.id === 'fact'}>
            <summary>
              {l.title}
              {lang === 'my' && <span className="muted" style={{ display: 'block', fontWeight: 400 }}>{l.titleMy}</span>}
            </summary>
            <ul className="lesson-body">
              {l.body.map((b) => <li key={b}>{b}</li>)}
            </ul>
            {l.examples?.map((e, i) => (
              <div className="example" key={i}>
                <div className="bad">✕ {e.bad}</div>
                <div className="good">○ {e.good}</div>
                <div className="why">{e.why}</div>
              </div>
            ))}
          </details>
        </div>
      ))}
    </>
  );
}
