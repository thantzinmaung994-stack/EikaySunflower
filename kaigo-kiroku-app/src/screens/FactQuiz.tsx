import { useMemo, useState } from 'react';
import { Ruby } from '../components/Ruby';
import { FACT_QUIZ, type FactItem } from '../data/factQuiz';
import { t } from '../i18n';
import { missedQuizIds, quizStats } from '../lib/progress';
import { my } from '../lib/myanmar';
import { newId } from '../lib/storage';
import type { Lang, QuizResult } from '../types';

interface Props {
  lang: Lang;
  quizzes: QuizResult[];
  onFinish: (r: QuizResult) => void;
}

const ROUND = 10;

function shuffle<T>(a: T[]): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

export function FactQuiz({ lang, quizzes, onFinish }: Props) {
  const missed = useMemo(() => missedQuizIds(quizzes), [quizzes]);
  const stats = quizStats(quizzes);
  const [items, setItems] = useState<FactItem[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);

  const start = (reviewOnly: boolean) => {
    const pool = reviewOnly ? FACT_QUIZ.filter((q) => missed.includes(q.id)) : FACT_QUIZ;
    setItems(shuffle(pool).slice(0, ROUND));
    setIdx(0);
    setAnswers({});
    setDone(false);
    window.scrollTo(0, 0);
  };

  if (!items) {
    return (
      <>
        <div className="card">
          <h2>{t(lang, 'quizTitle')}</h2>
          <p style={{ margin: '0 0 12px' }}><Ruby text={t(lang, 'quizIntro')} /></p>
          <button className="btn" onClick={() => start(false)}>▶ {t(lang, 'quizStart')}（{ROUND}{t(lang, 'questions')}）</button>
          {missed.length > 0 && (
            <button className="btn secondary" style={{ marginTop: 8 }} onClick={() => start(true)}>
              🔁 {t(lang, 'quizReview')}（{missed.length}{t(lang, 'questions')}）
            </button>
          )}
        </div>
        <div className="card">
          <h2>{t(lang, 'quizRecord')}</h2>
          {stats.rounds === 0 ? (
            <div className="muted">{t(lang, 'noRecords')}</div>
          ) : (
            <div className="score-bars">
              <div><b>{stats.rounds}</b>{t(lang, 'rounds')}</div>
              <div><b>{stats.rate}%</b>{t(lang, 'correctRate')}</div>
              <div><b>{missed.length}</b>{t(lang, 'toReview')}</div>
            </div>
          )}
        </div>
      </>
    );
  }

  const q = items[idx];
  const answered = q && answers[q.id] !== undefined;
  const correctCount = Object.values(answers).filter(Boolean).length;

  const answer = (a: FactItem['answer']) => {
    if (answered) return;
    setAnswers({ ...answers, [q.id]: a === q.answer });
  };

  const next = () => {
    if (idx + 1 < items.length) {
      setIdx(idx + 1);
      return;
    }
    const result: QuizResult = {
      id: newId(),
      createdAt: new Date().toISOString(),
      total: items.length,
      correct: correctCount,
      askedIds: items.map((x) => x.id),
      wrongIds: items.filter((x) => !answers[x.id]).map((x) => x.id),
    };
    onFinish(result);
    setDone(true);
    window.scrollTo(0, 0);
  };

  if (done) {
    const wrong = items.filter((x) => !answers[x.id]);
    return (
      <>
        <div className="card">
          <div className="score-big">
            <div className={`num ${correctCount >= 8 ? 'good' : correctCount >= 5 ? 'mid' : 'low'}`}>{correctCount}</div>
            <div className="muted">/ {items.length} {t(lang, 'correct')}</div>
          </div>
        </div>
        {wrong.length > 0 && (
          <div className="card">
            <h2>{t(lang, 'wrongList')}</h2>
            {wrong.map((x) => (
              <div className="example" key={x.id}>
                <div><Ruby text={x.text} /></div>
                <div className="why">→ {x.answer === 'fact' ? t(lang, 'fact') : t(lang, 'interp')}：<Ruby text={x.why} /></div>
                {x.better && <div className="good">○ <Ruby text={x.better} /></div>}
              </div>
            ))}
          </div>
        )}
        <div className="row">
          <button className="btn secondary" onClick={() => setItems(null)}>{t(lang, 'back')}</button>
          <button className="btn" onClick={() => start(false)}>{t(lang, 'tryAgain')}</button>
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
        <div className="muted">{idx + 1} / {items.length}</div>
        <div className="quiz-q"><Ruby text={q.text} /></div>
        <div className="muted" style={{ marginBottom: 8 }}>{t(lang, 'quizAsk')}</div>
        <div className="row">
          {(['fact', 'interp'] as const).map((a) => {
            const state = !answered ? '' : a === q.answer ? ' right' : answers[q.id] ? '' : ' chosen-wrong';
            return (
              <button key={a} className={`btn quiz-btn${state}`} onClick={() => answer(a)} disabled={answered}>
                {a === 'fact' ? `👁 ${t(lang, 'fact')}` : `💭 ${t(lang, 'interp')}`}
              </button>
            );
          })}
        </div>
        {answered && (
          <div className={`finding ${answers[q.id] ? 'good' : 'error'}`} style={{ marginTop: 12 }}>
            <span className="part">{answers[q.id] ? '○' : '×'}</span>
            <div>
              <Ruby text={q.why} />
              {lang === 'my' && my(`quiz.${q.id}.why`) && <span className="sug">{my(`quiz.${q.id}.why`)}</span>}
              {q.better && <span className="sug">→ <Ruby text={q.better} /></span>}
            </div>
          </div>
        )}
      </div>
      {answered && (
        <button className="btn" onClick={next}>{idx + 1 < items.length ? t(lang, 'next') : t(lang, 'result')}</button>
      )}
      <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setItems(null)}>{t(lang, 'back')}</button>
    </>
  );
}
