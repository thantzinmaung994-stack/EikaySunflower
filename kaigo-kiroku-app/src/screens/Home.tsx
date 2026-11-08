import { Ruby } from '../components/Ruby';
import { categoryById, catName } from '../data/categories';
import { SCENARIOS } from '../data/scenarios';
import { t } from '../i18n';
import {
  activeDays, categoryProgress, dayKey, lastWeek, MASTERY, reviewScenarios, streak, todaysScenario, weakPoints,
} from '../lib/progress';
import type { CategoryId, Lang, QuizResult, RecordEntry } from '../types';
import { isFreeScenario } from '../lib/premium';
import logoFull from '../assets/logo-full.png';

interface Props {
  lang: Lang;
  records: RecordEntry[];
  quizzes: QuizResult[];
  dailyGoal: number;
  premium: boolean;
  onScenario: (id: string) => void;
  onQuiz: () => void;
  onFree: (cat?: CategoryId) => void;
  onPractice: () => void;
}

const grade = (s: number) => (s >= MASTERY ? 'good' : s >= 50 ? 'mid' : 'low');

export function Home({ lang, records, quizzes, dailyGoal, premium, onScenario, onQuiz, onFree, onPractice }: Props) {
  const days = activeDays(records, quizzes);
  const st = streak(days);
  const week = lastWeek(days);
  const today = dayKey(new Date());
  const doneScenes = records.filter((r) => dayKey(r.createdAt) === today).length;
  const doneQuiz = quizzes.some((q) => dayKey(q.createdAt) === today);
  const goalMet = doneScenes >= dailyGoal && doneQuiz;
  const todays = todaysScenario(records, new Date(), (s) => premium || isFreeScenario(s));
  const review = reviewScenarios(records).slice(0, 3);
  const weak = weakPoints(records);
  const progress = categoryProgress(records);
  const mastered = progress.reduce((s, p) => s + p.mastered, 0);
  const isNew = records.length === 0 && quizzes.length === 0;
  const tc = categoryById(todays.category);

  return (
    <>
      <div className="brand">
        <img src={logoFull} alt="EIKAY SUNFLOWER Education & Learning" />
      </div>

      {isNew ? (
        <div className="card hero">
          <h1><Ruby text={t(lang, 'heroTitle')} /></h1>
          <p><Ruby text={t(lang, 'heroSub')} /></p>
          <button className="btn" onClick={() => onScenario(todays.id)}>📖 {t(lang, 'startFirst')}</button>
          <button className="btn secondary" style={{ marginTop: 8 }} onClick={onQuiz}>⚡ {t(lang, 'tryQuiz')}</button>
        </div>
      ) : (
        <div className="card hero">
          <div className="streak">
            <div className="streak-num">🔥 {st.count}<small>{t(lang, 'daysStreak')}</small></div>
            <div className="week">
              {week.map((d) => (
                <div key={d.key} className={`day${d.done ? ' done' : ''}${d.key === today ? ' today' : ''}`}>
                  <span>{d.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="goal">
            <div className={`goal-item${doneScenes >= dailyGoal ? ' ok' : ''}`}>
              {doneScenes >= dailyGoal ? '✓' : '○'} {t(lang, 'goalScene')} {Math.min(doneScenes, dailyGoal)}/{dailyGoal}
            </div>
            <div className={`goal-item${doneQuiz ? ' ok' : ''}`}>{doneQuiz ? '✓' : '○'} {t(lang, 'goalQuiz')}</div>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            {goalMet ? t(lang, 'goalDone') : st.doneToday ? t(lang, 'keepGoing') : t(lang, 'dontBreak')}
          </div>
        </div>
      )}

      <div className="card">
        <div className="eyebrow">{t(lang, 'todaysScene')}</div>
        <button className="list-item plain" onClick={() => onScenario(todays.id)}>
          <span className="ico">{tc.icon}</span>
          <div className="body">
            <b><Ruby text={todays.title} /></b>
            <div className="meta">
              <span className={`badge lv${todays.level}`}>{t(lang, 'level')} {todays.level}</span>
              {catName(tc, lang)} ・ {t(lang, 'aboutMin')}
            </div>
          </div>
          <span className="go">›</span>
        </button>
        {!isNew && !doneQuiz && (
          <button className="btn secondary" onClick={onQuiz}>⚡ {t(lang, 'quizShort')}</button>
        )}
      </div>

      {review.length > 0 && (
        <div className="card">
          <h2>🔁 {t(lang, 'reviewTitle')}</h2>
          {review.map(({ scenario, best }) => (
            <button key={scenario.id} className="list-item" onClick={() => onScenario(scenario.id)}>
              <span className="ico">{categoryById(scenario.category).icon}</span>
              <div className="body"><b><Ruby text={scenario.title} /></b></div>
              <div className={`score-pill ${grade(best)}`}>{best}</div>
            </button>
          ))}
        </div>
      )}

      {weak.length > 0 && (
        <div className="card">
          <h2>📌 {t(lang, 'weakTitle')}</h2>
          <ul className="check-list">
            {weak.map((w) => (
              <li key={w.code}>
                <span className="mark ng">!</span>
                <div>
                  <Ruby text={w.label} />
                  <small><Ruby text={w.tip} /></small>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2>{t(lang, 'progressTitle')}</h2>
        <div className="overall">
          <div className="bar"><div style={{ width: `${(mastered / SCENARIOS.length) * 100}%` }} /></div>
          <span>{mastered}/{SCENARIOS.length}</span>
        </div>
        <div className="cat-progress">
          {progress.map(({ category, total, mastered: m }) => (
            <button key={category.id} className="cat-row" onClick={onPractice}>
              <span className="ico">{category.icon}</span>
              <span className="name">{catName(category, lang)}</span>
              <span className="bar small"><span style={{ width: `${(m / total) * 100}%` }} /></span>
              <span className="count">{m}/{total}</span>
            </button>
          ))}
        </div>
        <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => onFree()}>✏️ {t(lang, 'freeRecord')}</button>
      </div>
    </>
  );
}
