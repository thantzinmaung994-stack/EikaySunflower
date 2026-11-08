import { useEffect, useMemo, useState } from 'react';
import { Ruby } from '../components/Ruby';
import { GLOSSARY, GLOSSARY_GROUPS, type GlossaryGroup } from '../data/glossary';
import { t } from '../i18n';
import { my } from '../lib/myanmar';
import { isFreeTerm } from '../lib/premium';
import type { Lang } from '../types';

const PAGE = 60;

const toKata = (s: string) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

export function Glossary({ lang, premium, onLocked }: { lang: Lang; premium: boolean; onLocked: () => void }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<GlossaryGroup | 'all'>('all');
  const [shown, setShown] = useState(PAGE);
  // グループごとの語数（試験科目の順）
  const groups = useMemo(() => GLOSSARY_GROUPS.map((g) => [g, GLOSSARY.filter((x) => x.group === g).length] as const).filter(([, n]) => n > 0), []);
  // 科目の順 → 読みのあいうえお順（辞書のように引ける）
  const sorted = useMemo(
    () => [...GLOSSARY].sort((a, b) => GLOSSARY_GROUPS.indexOf(a.group) - GLOSSARY_GROUPS.indexOf(b.group) || a.yomi.localeCompare(b.yomi, 'ja')),
    [],
  );
  const matches = useMemo(() => {
    const k = q.trim();
    return sorted.filter((g) => {
      if (group !== 'all' && g.group !== group) return false;
      if (!k) return true;
      // 漢字・ひらがな・カタカナ・ミャンマー語・英字のどれでも探せる
      return [g.term, g.yomi, toKata(g.yomi), my(`glossary.${g.term}`) ?? '', g.meaning].some((x) => x.toLowerCase().includes(k.toLowerCase()) || toKata(x).includes(toKata(k)));
    });
  }, [q, group, sorted]);
  // 無料プランは約25%の用語だけ。条件に合うプレミアムの用語は、数と見出しだけ見せる
  const list = useMemo(() => (premium ? matches : matches.filter(isFreeTerm)), [matches, premium]);
  const locked = useMemo(() => (premium ? [] : matches.filter((g) => !isFreeTerm(g))), [matches, premium]);
  const freeTotal = useMemo(() => GLOSSARY.filter(isFreeTerm).length, []);

  // 検索やグループを変えたら、また先頭から60語だけ出す
  useEffect(() => setShown(PAGE), [q, group]);

  return (
    <>
      <div className="card">
        <h2>{t(lang, 'glossaryTitle')}</h2>
        <div className="field" style={{ marginBottom: 8 }}>
          <input id="glossary-search" type="search" value={q} placeholder={t(lang, 'searchPh')} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <select id="glossary-group" value={group} onChange={(e) => setGroup(e.target.value as GlossaryGroup | 'all')}>
            <option value="all">ALL（{GLOSSARY.length}）</option>
            {groups.map(([g, n]) => (
              <option key={g} value={g}>{g}（{n}）</option>
            ))}
          </select>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>{list.length} {t(lang, 'terms')}</div>
        {!premium && (
          <button className="lock-note" style={{ marginTop: 8, marginBottom: 0 }} onClick={onLocked}>
            🔒 {t(lang, 'freeTermsNote').replace('{free}', String(freeTotal)).replace('{all}', String(GLOSSARY.length))}
          </button>
        )}
      </div>
      {list.slice(0, shown).map((g) => (
        <div className="card term" key={g.term}>
          <div className="term-head">
            <b className="term-word">{g.term}</b>
            {/[\u4e00-\u9fff々]/.test(g.term) && <span className="term-yomi">{g.yomi}</span>}
          </div>
          {my(`glossary.${g.term}`) && <div className="term-my">🇲🇲 {my(`glossary.${g.term}`)}</div>}
          <div className="term-meaning"><Ruby text={g.meaning} /></div>
          {g.example && <div className="term-example">✍ <Ruby text={g.example} /></div>}
        </div>
      ))}
      {list.length > shown && (
        <button className="btn secondary" onClick={() => setShown(shown + PAGE)}>
          {t(lang, 'showMore')}（{shown}/{list.length}）
        </button>
      )}
      {locked.length > 0 && list.length <= shown && (
        <div className="card locked-terms">
          <b>🔒 {t(lang, 'lockedTerms').replace('{n}', String(locked.length))}</b>
          <div className="preview">{locked.slice(0, 6).map((g) => g.term).join('・')}{locked.length > 6 ? ' …' : ''}</div>
          <button className="btn gold small" onClick={onLocked}>{t(lang, 'seePremium')}</button>
        </div>
      )}
      {list.length === 0 && locked.length === 0 && <div className="empty">{t(lang, 'noMatch')}</div>}
    </>
  );
}
