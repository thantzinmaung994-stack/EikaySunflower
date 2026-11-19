import { useState } from 'react';
import { t } from '../i18n';
import { charDiff, compareFindings, sameRatio, type Attempt } from '../lib/attempts';
import type { CheckResult } from '../lib/checker';
import type { Lang, Soap } from '../types';
import { Ruby } from './Ruby';

interface Props {
  lang: Lang;
  /** 書き直す前の回（古い順） */
  history: Attempt[];
  soap: Soap;
  result: CheckResult;
  /** 場面モードのときだけ点数を出す */
  scored: boolean;
}

const PARTS: { k: keyof Soap; letter: 'S' | 'O' | 'A' | 'P' }[] = [
  { k: 's', letter: 'S' },
  { k: 'o', letter: 'O' },
  { k: 'a', letter: 'A' },
  { k: 'p', letter: 'P' },
];

/** 書き直したあとに、前回の文章・点数・指摘と今回を並べて見せる */
export function AttemptCompare({ lang, history, soap, result, scored }: Props) {
  const [showText, setShowText] = useState(true);
  const prev = history[history.length - 1];
  if (!prev) return null;
  const diff = result.score - prev.result.score;
  const { fixed, added } = compareFindings(prev.result, result);
  const changed = PARTS.filter(({ k }) => prev.soap[k] !== soap[k]);

  return (
    <div className="card compare">
      <h2>🔁 {t(lang, 'compareTitle')}<span className="muted"> （{history.length + 1}{t(lang, 'compareNth')}）</span></h2>

      {scored && (
        <div className="compare-score">
          <div><small>{t(lang, 'comparePrev')}</small><b>{prev.result.score}</b></div>
          <div className="arrow">→</div>
          <div><small>{t(lang, 'compareNow')}</small><b>{result.score}</b></div>
          <div className={`delta ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>{diff > 0 ? `+${diff}` : diff === 0 ? '±0' : diff}</div>
        </div>
      )}
      {scored && history.length > 1 && (
        <div className="muted" style={{ textAlign: 'center' }}>
          {[...history.map((h) => h.result.score), result.score].join(' → ')}
        </div>
      )}

      {fixed.length > 0 && (
        <>
          <h3>✓ <Ruby text={t(lang, 'compareFixed')} />（{fixed.length}）</h3>
          {fixed.map((f, i) => (
            <div key={i} className="finding good">
              <span className="part">{f.part}</span>
              <div>{f.match && <mark>{f.match}</mark>} <Ruby text={f.message.replace(`「${f.match}」`, '')} /></div>
            </div>
          ))}
        </>
      )}
      {added.length > 0 && (
        <>
          <h3>⚠ <Ruby text={t(lang, 'compareAdded')} />（{added.length}）</h3>
          {added.map((f, i) => (
            <div key={i} className={`finding ${f.severity}`}>
              <span className="part">{f.part}</span>
              <div>{f.match && <mark>{f.match}</mark>} <Ruby text={f.message.replace(`「${f.match}」`, '')} /></div>
            </div>
          ))}
        </>
      )}
      {fixed.length === 0 && added.length === 0 && <p className="muted"><Ruby text={t(lang, 'compareSame')} /></p>}

      {changed.length > 0 && (
        <>
          <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setShowText((v) => !v)}>
            {showText ? t(lang, 'compareHideText') : t(lang, 'compareShowText')}
          </button>
          {showText &&
            changed.map(({ k, letter }) => {
              const d = charDiff(prev.soap[k], soap[k]);
              // 半分以上書き直したときは、前回と今回を上下に並べる（細かい差分は読みにくいため）
              const whole = sameRatio(d) < 0.5;
              return (
                <div key={k} className="compare-text">
                  <span className={`soap-letter ${letter}`}>{letter}</span>
                  {whole ? (
                    <div className="compare-whole">
                      <small>{t(lang, 'comparePrev')}</small>
                      <p><del>{prev.soap[k] || '—'}</del></p>
                      <small>{t(lang, 'compareNow')}</small>
                      <p><ins>{soap[k] || '—'}</ins></p>
                    </div>
                  ) : (
                    <p>
                      {d.map((p, i) =>
                        p.type === 'same' ? <span key={i}>{p.text}</span> : p.type === 'add' ? <ins key={i}>{p.text}</ins> : <del key={i}>{p.text}</del>,
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          {showText && <div className="muted"><Ruby text={t(lang, 'compareLegend')} /></div>}
        </>
      )}
    </div>
  );
}
