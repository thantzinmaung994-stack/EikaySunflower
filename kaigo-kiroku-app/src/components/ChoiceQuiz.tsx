import { useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { newId } from '../lib/storage';
import type { Lang, QuizResult } from '../types';
import { Ruby } from './Ruby';

export interface ChoiceItem {
  id: string;
  /** 問題文の上に小さく出す説明（例：場面のタイトル） */
  context?: string;
  prompt: string;
  choices: string[];
  answer: number;
  why: string;
  /** 正解のあとに出す補足（ミャンマー語など） */
  extra?: ReactNode;
}

interface Props {
  lang: Lang;
  kind: string;
  items: ChoiceItem[];
  ask: string;
  /** 選択肢を横に並べる（短い選択肢のとき） */
  compact?: boolean;
  onFinish: (r: QuizResult) => void;
  onBack: () => void;
  onRetry: () => void;
}

/** 選択式クイズの共通部品（SOAP・言い換え・5W1H・用語クイズで使う） */
export function ChoiceQuiz({ lang, kind, items, ask, compact, onFinish, onBack, onRetry }: Props) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const q = items[idx];
  const answered = q && picked[q.id] !== undefined;
  const correct = items.filter((x) => picked[x.id] === x.answer).length;

  const next = () => {
    if (idx + 1 < items.length) {
      setIdx(idx + 1);
      return;
    }
    onFinish({
      id: newId(),
      createdAt: new Date().toISOString(),
      kind,
      total: items.length,
      correct,
      askedIds: items.map((x) => x.id),
      wrongIds: items.filter((x) => picked[x.id] !== x.answer).map((x) => x.id),
    });
    setDone(true);
    window.scrollTo(0, 0);
  };

  if (!items.length) return <div className="empty">{t(lang, 'noMatch')}</div>;

  if (done) {
    const wrong = items.filter((x) => picked[x.id] !== x.answer);
    return (
      <>
        <div className="card">
          <div className="score-big">
            <div className={`num ${correct >= items.length * 0.8 ? 'good' : correct >= items.length * 0.5 ? 'mid' : 'low'}`}>{correct}</div>
            <div className="muted">/ {items.length} {t(lang, 'correct')}</div>
          </div>
        </div>
        {wrong.length > 0 && (
          <div className="card">
            <h2>{t(lang, 'wrongList')}</h2>
            {wrong.map((x) => (
              <div className="example" key={x.id}>
                {x.context && <div className="muted">{x.context}</div>}
                <div><Ruby text={x.prompt} /></div>
                <div className="good">○ <Ruby text={x.choices[x.answer]} /></div>
                <div className="why"><Ruby text={x.why} /></div>
              </div>
            ))}
          </div>
        )}
        <div className="row">
          <button className="btn secondary" onClick={onBack}>{t(lang, 'back')}</button>
          <button className="btn" onClick={onRetry}>{t(lang, 'tryAgain')}</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="stepper">
        {items.map((x, i) => (
          <div key={x.id} className={i < idx || (i === idx && answered) ? 'done' : ''} />
        ))}
      </div>
      <div className="card">
        <div className="muted">{idx + 1} / {items.length}{q.context ? `　${q.context}` : ''}</div>
        <div className="quiz-q"><Ruby text={q.prompt} /></div>
        <div className="muted" style={{ marginBottom: 8 }}>{ask}</div>
        <div className={compact ? 'choice-grid' : 'choice-list'}>
          {q.choices.map((c, i) => {
            const state = !answered ? '' : i === q.answer ? ' right' : picked[q.id] === i ? ' chosen-wrong' : ' dim';
            return (
              <button key={i} className={`btn quiz-btn choice${state}`} disabled={answered} onClick={() => setPicked({ ...picked, [q.id]: i })}>
                {/* ふりがなの部品がボタンの中で横に並ばないよう、1つの文としてまとめる */}
                <span className="choice-text"><Ruby text={c} /></span>
              </button>
            );
          })}
        </div>
        {answered && (
          <div className={`finding ${picked[q.id] === q.answer ? 'good' : 'error'}`} style={{ marginTop: 12 }}>
            <span className="part">{picked[q.id] === q.answer ? '○' : '×'}</span>
            <div>
              <Ruby text={q.why} />
              {q.extra && <span className="sug">{q.extra}</span>}
            </div>
          </div>
        )}
      </div>
      {answered && <button className="btn" onClick={next}>{idx + 1 < items.length ? t(lang, 'next') : t(lang, 'result')}</button>}
      <button className="btn ghost" style={{ marginTop: 8 }} onClick={onBack}>{t(lang, 'back')}</button>
    </>
  );
}
