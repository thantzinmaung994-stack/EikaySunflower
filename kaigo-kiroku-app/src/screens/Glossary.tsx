import { useMemo, useState } from 'react';
import { Ruby } from '../components/Ruby';
import { GLOSSARY, type GlossaryGroup } from '../data/glossary';
import { t } from '../i18n';
import type { Lang } from '../types';

const toKata = (s: string) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

export function Glossary({ lang }: { lang: Lang }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<GlossaryGroup | 'all'>('all');
  const groups = useMemo(() => [...new Set(GLOSSARY.map((g) => g.group))], []);

  const list = useMemo(() => {
    const k = q.trim();
    return GLOSSARY.filter((g) => {
      if (group !== 'all' && g.group !== group) return false;
      if (!k) return true;
      // 漢字・ひらがな・カタカナ・ミャンマー語・英字のどれでも探せる
      return [g.term, g.yomi, toKata(g.yomi), g.my, g.meaning].some((x) => x.toLowerCase().includes(k.toLowerCase()) || toKata(x).includes(toKata(k)));
    });
  }, [q, group]);

  return (
    <>
      <div className="card">
        <h2>{t(lang, 'glossaryTitle')}</h2>
        <div className="field" style={{ marginBottom: 8 }}>
          <input id="glossary-search" type="search" value={q} placeholder={t(lang, 'searchPh')} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips">
          <button className={`chip${group === 'all' ? ' active' : ''}`} onClick={() => setGroup('all')}>ALL</button>
          {groups.map((g) => (
            <button key={g} className={`chip${group === g ? ' active' : ''}`} onClick={() => setGroup(g)}>{g}</button>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 6 }}>{list.length} {t(lang, 'terms')}</div>
      </div>
      {list.map((g) => (
        <div className="card term" key={g.term}>
          <div className="term-head">
            <b className="term-word">{g.term}</b>
            <span className="term-yomi">{g.yomi}</span>
          </div>
          <div className="term-my">🇲🇲 {g.my}</div>
          <div className="term-meaning"><Ruby text={g.meaning} /></div>
          {g.example && <div className="term-example">✍ <Ruby text={g.example} /></div>}
        </div>
      ))}
      {list.length === 0 && <div className="empty">{t(lang, 'noMatch')}</div>}
    </>
  );
}
