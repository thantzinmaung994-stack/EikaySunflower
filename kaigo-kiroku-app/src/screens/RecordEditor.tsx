import { useMemo, useState } from 'react';
import { FieldInput } from '../components/FieldInput';
import { ResultPanel } from '../components/ResultPanel';
import { CATEGORIES, categoryById } from '../data/categories';
import { t } from '../i18n';
import { evaluate, type CheckResult } from '../lib/checker';
import { newId } from '../lib/storage';
import type { CategoryId, FiveW1H, Lang, RecordEntry, Scenario, Soap } from '../types';

interface Props {
  lang: Lang;
  scenario?: Scenario;
  /** 自由記録で最初に選んでおく種類 */
  initialCategory?: CategoryId;
  onSave: (entry: RecordEntry) => void;
  onExit: () => void;
}

const EMPTY_W: FiveW1H = { when: '', where: '', who: '', what: '', why: '', how: '' };
const EMPTY_SOAP: Soap = { s: '', o: '', a: '', p: '' };

// 場面モード: 場面→項目→5W1H→SOAP→結果 / 自由モード: 項目→5W1H→SOAP→結果
export function RecordEditor({ lang, scenario, initialCategory, onSave, onExit }: Props) {
  const [categoryId, setCategoryId] = useState<CategoryId>(scenario?.category ?? initialCategory ?? 'vital');
  const category = categoryById(categoryId);
  const [resident, setResident] = useState(scenario?.resident ?? '');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [w, setW] = useState<FiveW1H>(EMPTY_W);
  const [soap, setSoap] = useState<Soap>(EMPTY_SOAP);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const steps = useMemo(() => (scenario ? ['scene', 'fields', 'w', 'soap', 'result'] : ['fields', 'w', 'soap', 'result']), [scenario]);
  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[stepIdx];

  const go = (d: number) => {
    setStepIdx((i) => Math.min(steps.length - 1, Math.max(0, i + d)));
    window.scrollTo(0, 0);
  };

  const buildEntry = (): RecordEntry => ({
    id: savedId ?? newId(),
    createdAt: new Date().toISOString(),
    mode: scenario ? 'scenario' : 'free',
    scenarioId: scenario?.id,
    category: categoryId,
    resident,
    fields,
    w,
    soap,
  });

  const runCheck = () => {
    if (!soap.o.trim()) {
      setError(t(lang, 'emptySoap'));
      return;
    }
    setError('');
    const entry = buildEntry();
    const r = evaluate(entry, scenario, category);
    setResult(r);
    go(1);
  };

  const save = () => {
    const entry = buildEntry();
    entry.score = result?.score;
    setSavedId(entry.id);
    onSave(entry);
  };

  // コンポーネントではなく関数にしておく（毎回別コンポーネントになるとフォーカスが外れる）
  const renderSoap = (k: keyof Soap, letter: 'S' | 'O' | 'A' | 'P') => (
    <div className="field" key={k}>
      <label className="soap-label">
        <span className={`soap-letter ${letter}`}>{letter}</span>
        {t(lang, k).replace(/^[SOAP]\s/, '')}
      </label>
      <textarea
        className={letter === 'O' ? 'big' : ''}
        value={soap[k]}
        placeholder={t(lang, `${k}Ph` as 'sPh')}
        onChange={(e) => setSoap({ ...soap, [k]: e.target.value })}
      />
    </div>
  );

  return (
    <>
      <div className="stepper">
        {steps.map((s, i) => (
          <div key={s} className={i <= stepIdx ? 'done' : ''} />
        ))}
      </div>

      <div className="card" style={{ borderLeft: `5px solid ${category.color}` }}>
        <div className="muted">
          {scenario ? t(lang, 'mode_scenario') : t(lang, 'mode_free')} ・ {category.icon} {lang === 'my' ? category.nameMy : category.name}
          {scenario && <> ・ <span className={`badge lv${scenario.level}`}>Lv.{scenario.level}</span></>}
        </div>
        {scenario && <h2 style={{ marginTop: 4 }}>{scenario.title}</h2>}
      </div>

      {step === 'scene' && scenario && (
        <div className="card">
          <h2>{t(lang, 'scene')}</h2>
          <div className="muted" style={{ marginBottom: 6 }}>{t(lang, 'resident')}: {scenario.resident}</div>
          <div className="story">{scenario.story}</div>
          {lang === 'my' && scenario.storyMy && <div className="story-my">{scenario.storyMy}</div>}
          <h3>{t(lang, 'tips')}</h3>
          <ul className="tips">
            {category.tips.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </div>
      )}

      {step === 'fields' && (
        <div className="card">
          <h2>{t(lang, 'fields')}</h2>
          {!scenario && (
            <>
              <div className="cat-grid" style={{ marginBottom: 12 }}>
                {CATEGORIES.map((c) => (
                  <button key={c.id} className={`cat-tile${c.id === categoryId ? ' active' : ''}`} onClick={() => { setCategoryId(c.id); setFields({}); }}>
                    <span className="ico">{c.icon}</span>
                    {lang === 'my' ? c.nameMy : c.name}
                  </button>
                ))}
              </div>
              <div className="field">
                <label>{t(lang, 'resident')}</label>
                <input type="text" value={resident} placeholder={t(lang, 'residentPh')} onChange={(e) => setResident(e.target.value)} />
              </div>
            </>
          )}
          <div className="fields-grid">
            {category.fields.map((def) => (
              <FieldInput key={def.id} def={def} lang={lang} value={fields[def.id] ?? ''} onChange={(v) => setFields({ ...fields, [def.id]: v })} />
            ))}
          </div>
          <h3>{t(lang, 'tips')}</h3>
          <ul className="tips">
            {category.tips.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </div>
      )}

      {step === 'w' && (
        <div className="card">
          <h2>{t(lang, 'write5w1h')}</h2>
          {scenario && (
            <details style={{ marginBottom: 8 }}>
              <summary>{t(lang, 'readScene')}</summary>
              <div className="story">{scenario.story}</div>
            </details>
          )}
          {(['when', 'where', 'who', 'what', 'why', 'how'] as const).map((k) => (
            <div className="field" key={k}>
              <label>{t(lang, k)}</label>
              <input type="text" value={w[k]} onChange={(e) => setW({ ...w, [k]: e.target.value })} />
            </div>
          ))}
        </div>
      )}

      {step === 'soap' && (
        <div className="card">
          <h2>{t(lang, 'writeSoap')}</h2>
          {scenario && (
            <details style={{ marginBottom: 8 }}>
              <summary>{t(lang, 'readScene')}</summary>
              <div className="story">{scenario.story}</div>
            </details>
          )}
          {renderSoap('s', 'S')}
          {renderSoap('o', 'O')}
          {renderSoap('a', 'A')}
          {renderSoap('p', 'P')}
          {error && <div className="finding error" role="alert">{error}</div>}
        </div>
      )}

      {step === 'result' && result && (
        <ResultPanel result={result} scenario={scenario} lang={lang} />
      )}

      <div className="row" style={{ marginTop: 8 }}>
        {stepIdx > 0 && step !== 'result' && (
          <button className="btn ghost" onClick={() => go(-1)}>{t(lang, 'back')}</button>
        )}
        {step === 'result' ? (
          <>
            <button className="btn ghost" onClick={() => go(-1)}>{t(lang, 'tryAgain')}</button>
            <button className="btn" onClick={save} disabled={!!savedId}>{savedId ? '✓ ' : ''}{t(lang, 'save')}</button>
            <button className="btn secondary" onClick={onExit}>{t(lang, 'toHistory')}</button>
          </>
        ) : step === 'soap' ? (
          <button className="btn" onClick={runCheck}>{t(lang, 'check')}</button>
        ) : (
          <button className="btn" onClick={() => go(1)}>{t(lang, 'next')}</button>
        )}
      </div>
      {stepIdx === 0 && (
        <button className="btn ghost" style={{ marginTop: 8 }} onClick={onExit}>{t(lang, 'back')}</button>
      )}
    </>
  );
}
