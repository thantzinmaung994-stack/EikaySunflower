import { useState } from 'react';
import type { CheckResult } from '../lib/checker';
import type { Lang, Scenario } from '../types';
import { t } from '../i18n';
import { my } from '../lib/myanmar';
import { Ruby } from './Ruby';
import { Speak } from './Speak';

interface Props {
  result: CheckResult;
  scenario?: Scenario;
  lang: Lang;
}

const grade = (s: number) => (s >= 80 ? 'good' : s >= 50 ? 'mid' : 'low');

export function ResultPanel({ result, scenario, lang }: Props) {
  const [showModel, setShowModel] = useState(false);
  const { findings, score, fieldHits, keyPointHits } = result;
  const fieldOk = fieldHits.filter((x) => x.ok).length;
  const kpOk = keyPointHits.filter((x) => x.hit).length;
  const errors = findings.filter((x) => x.severity === 'error').length;
  const warns = findings.filter((x) => x.severity === 'warn').length;

  return (
    <>
      {scenario && (
        <div className="card">
          <div className="score-big">
            <div className={`num ${grade(score)}`}>{score}</div>
            <div className="muted">/ 100 {t(lang, 'score')}</div>
          </div>
          <div className="score-bars">
            <div><b>{fieldOk}/{fieldHits.length}</b>{t(lang, 'fieldCheck')}</div>
            <div><b>{kpOk}/{keyPointHits.length}</b>{t(lang, 'keyPoints')}</div>
            <div><b>{Math.max(0, 30 - errors * 8 - warns * 4)}/30</b>{t(lang, 'writingCheck')}</div>
          </div>
        </div>
      )}

      {fieldHits.length > 0 && (
        <div className="card">
          <h2>{t(lang, 'fieldCheck')}</h2>
          <ul className="check-list">
            {fieldHits.map((f) => (
              <li key={f.id}>
                <span className={`mark ${f.ok ? 'ok' : 'ng'}`}>{f.ok ? '○' : '×'}</span>
                <div>
                  {f.label}
                  {!f.ok && (
                    <small>
                      {t(lang, 'expected')}: {f.expected} ／ {t(lang, 'yours')}: {f.actual || '—'}
                    </small>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {keyPointHits.length > 0 && (
        <div className="card">
          <h2>{t(lang, 'keyPoints')}</h2>
          <ul className="check-list">
            {keyPointHits.map((k) => (
              <li key={k.label}>
                <span className={`mark ${k.hit ? 'ok' : 'ng'}`}>{k.hit ? '○' : '×'}</span>
                <div>
                  {k.part && <span className={`soap-letter ${k.part}`} style={{ width: 20, height: 20, fontSize: 12, marginRight: 6 }}>{k.part}</span>}
                  <Ruby text={k.label} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2>{t(lang, 'writingCheck')}</h2>
        {findings.map((f, i) => (
          <div key={i} className={`finding ${f.severity}`}>
            <span className="part">{f.part}</span>
            <div>
              {f.match ? (
                <>
                  <mark>{f.match}</mark> <Ruby text={f.message.replace(`「${f.match}」`, '')} />
                </>
              ) : (
                <Ruby text={f.message} />
              )}
              {f.suggestion && <span className="sug">→ <Ruby text={f.suggestion} /></span>}
            </div>
          </div>
        ))}
      </div>

      {scenario && (
        <div className="card">
          <button className="btn secondary" onClick={() => setShowModel((v) => !v)}>
            {showModel ? t(lang, 'hideModel') : t(lang, 'modelAnswer')}
          </button>
          {showModel && (
            <>
              <h3>5W1H</h3>
              <dl className="model">
                <dt>When</dt><dd><Ruby text={scenario.model.w.when} /></dd>
                <dt>Where</dt><dd><Ruby text={scenario.model.w.where} /></dd>
                <dt>Who</dt><dd><Ruby text={scenario.model.w.who} /></dd>
                <dt>What</dt><dd><Ruby text={scenario.model.w.what} /></dd>
                <dt>Why</dt><dd><Ruby text={scenario.model.w.why} /></dd>
                <dt>How</dt><dd><Ruby text={scenario.model.w.how} /></dd>
              </dl>
              <h3 className="row-between">SOAP <Speak text={`${scenario.model.soap.s}。${scenario.model.soap.o}。${scenario.model.soap.a}。${scenario.model.soap.p}`} /></h3>
              <dl className="model">
                <dt>S</dt><dd><Ruby text={scenario.model.soap.s} /></dd>
                <dt>O</dt><dd><Ruby text={scenario.model.soap.o} /></dd>
                <dt>A</dt><dd><Ruby text={scenario.model.soap.a} /></dd>
                <dt>P</dt><dd><Ruby text={scenario.model.soap.p} /></dd>
              </dl>
              <h3>{t(lang, 'explanation')}</h3>
              <p style={{ fontSize: 14, margin: 0 }}><Ruby text={scenario.explanation} /></p>
              {lang === 'my' && my(`scenario.${scenario.id}.explanation`) && <p className="story-my">{my(`scenario.${scenario.id}.explanation`)}</p>}
            </>
          )}
        </div>
      )}
    </>
  );
}
