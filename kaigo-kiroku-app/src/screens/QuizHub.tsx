import { useMemo, useState } from 'react';
import { ChoiceQuiz, type ChoiceItem } from '../components/ChoiceQuiz';
import { Ruby } from '../components/Ruby';
import { FACT_QUIZ } from '../data/factQuiz';
import { GLOSSARY } from '../data/glossary';
import { REPHRASE_QUIZ } from '../data/rephraseQuiz';
import { SOAP_QUIZ } from '../data/soapQuiz';
import { t, type TKey } from '../i18n';
import { isFreeQuiz } from '../lib/premium';
import { build5W1H, buildRephrase, buildSoap, buildTermQuiz, rephrasePool, soapPool, termPool, W_ITEMS, wPool } from '../lib/quizBuilders';
import type { Lang, QuizResult } from '../types';
import { FactQuiz } from './FactQuiz';
import { Flashcards } from './Flashcards';

type Mode = 'fact' | 'soap' | 'rephrase' | 'w5h' | 'terms' | 'cards';

interface Props {
  lang: Lang;
  quizzes: QuizResult[];
  premium: boolean;
  onFinish: (r: QuizResult) => void;
  onLocked: () => void;
}

const MODES: { id: Mode; icon: string; title: TKey; desc: TKey }[] = [
  { id: 'fact', icon: '⚡', title: 'quizTitle', desc: 'modeFactDesc' },
  { id: 'soap', icon: '🗂', title: 'modeSoap', desc: 'modeSoapDesc' },
  { id: 'rephrase', icon: '✏️', title: 'modeRephrase', desc: 'modeRephraseDesc' },
  { id: 'w5h', icon: '🧩', title: 'modeW5h', desc: 'modeW5hDesc' },
  { id: 'terms', icon: '📖', title: 'modeTerms', desc: 'modeTermsDesc' },
  { id: 'cards', icon: '🃏', title: 'cardsTitle', desc: 'modeCardsDesc' },
];

export function QuizHub({ lang, quizzes, premium, onFinish, onLocked }: Props) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [round, setRound] = useState(0);

  // 無料で出せる数 / 全部の数
  const counts: Record<Mode, [number, number]> = useMemo(
    () => ({
      fact: [FACT_QUIZ.filter(isFreeQuiz).length, FACT_QUIZ.length],
      soap: [soapPool(false).length, SOAP_QUIZ.length],
      rephrase: [rephrasePool(false).length, REPHRASE_QUIZ.length],
      w5h: [wPool(false).length, W_ITEMS.length],
      terms: [termPool(false).length, GLOSSARY.length],
      cards: [termPool(false).length, GLOSSARY.length],
    }),
    [],
  );

  // 同じラウンドの間は問題を固定する（round を変えると作り直す）
  const items: ChoiceItem[] = useMemo(() => {
    if (mode === 'soap') return buildSoap(premium);
    if (mode === 'rephrase') return buildRephrase(premium);
    if (mode === 'w5h') return build5W1H(premium);
    if (mode === 'terms') return buildTermQuiz(premium);
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, premium, round]);

  const back = () => {
    setMode(null);
    window.scrollTo(0, 0);
  };

  if (mode === 'fact') {
    return (
      <>
        <FactQuiz lang={lang} quizzes={quizzes.filter((q) => !q.kind)} onFinish={onFinish} premium={premium} onLocked={onLocked} />
        <button className="btn ghost" style={{ marginTop: 8 }} onClick={back}>{t(lang, 'quizMenu')}</button>
      </>
    );
  }
  if (mode === 'cards') return <Flashcards lang={lang} premium={premium} onLocked={onLocked} onBack={back} />;
  if (mode) {
    const ask = mode === 'soap' ? t(lang, 'askSoap') : mode === 'rephrase' ? t(lang, 'askRephrase') : mode === 'w5h' ? t(lang, 'askW5h') : t(lang, 'askTerms');
    return (
      <ChoiceQuiz
        key={`${mode}-${round}`}
        lang={lang}
        kind={mode}
        items={items}
        ask={ask}
        compact={mode === 'soap' || mode === 'w5h'}
        onFinish={onFinish}
        onBack={back}
        onRetry={() => setRound((r) => r + 1)}
      />
    );
  }

  return (
    <>
      <div className="card">
        <h2>{t(lang, 'quizMenu')}</h2>
        <div className="muted"><Ruby text={t(lang, 'quizMenuNote')} /></div>
      </div>
      {MODES.map((m) => {
        const [free, all] = counts[m.id];
        const last = quizzes.find((q) => (q.kind ?? 'fact') === m.id);
        return (
          <button key={m.id} className="list-item mode" onClick={() => { setMode(m.id); setRound((r) => r + 1); window.scrollTo(0, 0); }}>
            <span className="ico">{m.icon}</span>
            <div className="body">
              <b>{t(lang, m.title)}</b>
              <div className="meta"><Ruby text={t(lang, m.desc)} /></div>
              <div className="meta">
                {premium ? `${all}${m.id === 'terms' || m.id === 'cards' ? t(lang, 'termsUnit') : t(lang, 'questionsUnit')}` : `🔒 ${t(lang, 'freeOf').replace('{free}', String(free)).replace('{all}', String(all))}`}
                {last && `　${t(lang, 'lastScore')} ${last.correct}/${last.total}`}
              </div>
            </div>
            <span className="go">›</span>
          </button>
        );
      })}
      {!premium && (
        <button className="btn gold" onClick={onLocked}>⭐ {t(lang, 'seePremium')}</button>
      )}
    </>
  );
}
