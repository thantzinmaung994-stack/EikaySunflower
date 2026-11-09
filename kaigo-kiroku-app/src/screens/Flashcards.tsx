import { useMemo, useState } from 'react';
import { Ruby } from '../components/Ruby';
import { Speak } from '../components/Speak';
import { GLOSSARY, GLOSSARY_GROUPS, type GlossaryGroup } from '../data/glossary';
import { t } from '../i18n';
import { my } from '../lib/myanmar';
import { termPool } from '../lib/quizBuilders';
import { deckStats, todaysDeck, useStudy } from '../lib/study';
import type { Lang } from '../types';

type Source = 'all' | 'favorites' | 'weak' | GlossaryGroup;

interface Props {
  lang: Lang;
  premium: boolean;
  onLocked: () => void;
  onBack: () => void;
}

const BY_TERM = new Map(GLOSSARY.map((g) => [g.term, g]));
const HAS_KANJI = /[一-鿿々]/;

/** 用語カード：期限が来たカード → 新しいカードの順に20枚。「覚えた」で次に出す日が延びる */
export function Flashcards({ lang, premium, onLocked, onBack }: Props) {
  const { cards, favorites, answerCard } = useStudy();
  const [source, setSource] = useState<Source>('all');
  const [deck, setDeck] = useState<string[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knewCount, setKnewCount] = useState(0);

  const allowed = useMemo(() => termPool(premium).map((g) => g.term), [premium]);
  const pool = useMemo(() => {
    if (source === 'all') return allowed;
    if (source === 'favorites') return allowed.filter((k) => favorites.has(k));
    if (source === 'weak') return allowed.filter((k) => (cards[k]?.misses ?? 0) > 0 && (cards[k]?.box ?? 0) < 3);
    return allowed.filter((k) => BY_TERM.get(k)?.group === source);
  }, [source, allowed, favorites, cards]);
  const stats = deckStats(pool, cards);

  const start = () => {
    setDeck(todaysDeck(pool, cards, 20));
    setIdx(0);
    setFlipped(false);
    setKnewCount(0);
    window.scrollTo(0, 0);
  };

  if (!deck) {
    return (
      <>
        <div className="card">
          <h2>🃏 {t(lang, 'cardsTitle')}</h2>
          <p style={{ margin: '0 0 10px' }}><Ruby text={t(lang, 'cardsIntro')} /></p>
          <div className="field">
            <label htmlFor="card-source">{t(lang, 'cardsSource')}</label>
            <select id="card-source" value={source} onChange={(e) => setSource(e.target.value as Source)}>
              <option value="all">{t(lang, 'cardsAll')}</option>
              <option value="favorites">⭐ {t(lang, 'favorites')}（{allowed.filter((k) => favorites.has(k)).length}）</option>
              <option value="weak">📌 {t(lang, 'cardsWeak')}</option>
              {GLOSSARY_GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="score-bars" style={{ marginBottom: 12 }}>
            <div><b>{stats.learned}</b>{t(lang, 'cardsLearned')}</div>
            <div><b>{stats.due}</b>{t(lang, 'cardsDue')}</div>
            <div><b>{stats.total - stats.seen}</b>{t(lang, 'cardsNew')}</div>
          </div>
          <button className="btn" onClick={start} disabled={pool.length === 0}>▶ {t(lang, 'cardsStart')}</button>
          {pool.length === 0 && <div className="muted" style={{ marginTop: 6 }}>{t(lang, source === 'favorites' ? 'favoritesEmpty' : 'noMatch')}</div>}
          {!premium && (
            <button className="lock-note" style={{ marginTop: 10, marginBottom: 0 }} onClick={onLocked}>
              🔒 {t(lang, 'freeTermsNote').replace('{free}', String(allowed.length)).replace('{all}', String(GLOSSARY.length))}
            </button>
          )}
        </div>
        <button className="btn ghost" onClick={onBack}>{t(lang, 'back')}</button>
      </>
    );
  }

  if (idx >= deck.length) {
    return (
      <>
        <div className="card">
          <div className="score-big">
            <div className="num good">{knewCount}</div>
            <div className="muted">/ {deck.length} {t(lang, 'cardsKnew')}</div>
          </div>
          <p className="muted" style={{ textAlign: 'center' }}>{t(lang, 'cardsDoneNote')}</p>
        </div>
        <div className="row">
          <button className="btn secondary" onClick={() => setDeck(null)}>{t(lang, 'back')}</button>
          <button className="btn" onClick={start}>{t(lang, 'tryAgain')}</button>
        </div>
      </>
    );
  }

  const g = BY_TERM.get(deck[idx])!;
  const myText = my(`glossary.${g.term}`);
  const answer = (knew: boolean) => {
    answerCard(g.term, knew);
    if (knew) setKnewCount((n) => n + 1);
    setFlipped(false);
    setIdx(idx + 1);
  };

  return (
    <>
      <div className="stepper">
        {deck.map((k, i) => <div key={k} className={i < idx ? 'done' : ''} />)}
      </div>
      <div
        className={`card flashcard${flipped ? ' flipped' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={t(lang, 'cardsFlip')}
        onClick={() => setFlipped(true)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setFlipped(true)}
      >
        <div className="muted">{idx + 1} / {deck.length}　{g.group}</div>
        <div className="fc-term">
          {g.term}
          <Speak text={HAS_KANJI.test(g.term) ? g.yomi : g.term} />
        </div>
        {flipped ? (
          <div className="fc-back">
            {HAS_KANJI.test(g.term) && <div className="term-yomi">{g.yomi}</div>}
            {myText && <div className="term-my">🇲🇲 {myText}</div>}
            <div className="term-meaning"><Ruby text={g.meaning} /></div>
            {g.example && <div className="term-example">✍ <Ruby text={g.example} /></div>}
          </div>
        ) : (
          <div className="fc-hint">{t(lang, 'cardsFlip')}</div>
        )}
      </div>
      {flipped && (
        <div className="row">
          <button className="btn secondary" onClick={() => answer(false)}>🔁 {t(lang, 'cardsAgain')}</button>
          <button className="btn" onClick={() => answer(true)}>✓ {t(lang, 'cardsGot')}</button>
        </div>
      )}
      <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setDeck(null)}>{t(lang, 'back')}</button>
    </>
  );
}
