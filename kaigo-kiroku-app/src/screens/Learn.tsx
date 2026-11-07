import { useState } from 'react';
import { Ruby } from '../components/Ruby';
import { LESSONS } from '../data/lessons';
import { t } from '../i18n';
import type { Lang } from '../types';
import { Glossary } from './Glossary';

export function Learn({ lang }: { lang: Lang }) {
  const [tab, setTab] = useState<'basics' | 'glossary'>('basics');
  return (
    <>
      <div className="seg wide" style={{ marginBottom: 12 }}>
        <button className={tab === 'basics' ? 'on' : ''} onClick={() => setTab('basics')}>🎓 {t(lang, 'learnTitle')}</button>
        <button className={tab === 'glossary' ? 'on' : ''} onClick={() => setTab('glossary')}>📖 {t(lang, 'glossaryTitle')}</button>
      </div>
      {tab === 'glossary' ? (
        <Glossary lang={lang} />
      ) : (
        <>
          <div className="card">
            <div className="muted"><Ruby text="介護福祉士国家試験「コミュニケーション技術」「介護過程」の出題範囲に対応" /></div>
          </div>
          {LESSONS.map((l) => (
            <div className="card" key={l.id}>
              <details open={l.id === 'fact'}>
                <summary>
                  <Ruby text={l.title} />
                  {lang === 'my' && <span className="muted" style={{ display: 'block', fontWeight: 400 }}>{l.titleMy}</span>}
                </summary>
                <ul className="lesson-body">
                  {l.body.map((b) => <li key={b}><Ruby text={b} /></li>)}
                </ul>
                {l.examples?.map((e, i) => (
                  <div className="example" key={i}>
                    <div className="bad">✕ <Ruby text={e.bad} /></div>
                    <div className="good">○ <Ruby text={e.good} /></div>
                    <div className="why"><Ruby text={e.why} /></div>
                  </div>
                ))}
              </details>
            </div>
          ))}
        </>
      )}
    </>
  );
}
