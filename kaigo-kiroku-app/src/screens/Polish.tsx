import { useMemo, useState } from 'react';
import { Ruby } from '../components/Ruby';
import { t } from '../i18n';
import { polish, type PolishResult } from '../lib/polish';
import type { Settings } from '../lib/settings';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onBack: () => void;
}

const EXAMPLE = 'Aさんは午前中リハビリ体操を参加され、体を良く動かされる';

/** ［　］の部分（書き足すところ）を目立たせる */
function Draft({ text }: { text: string }) {
  const parts = text.split(/(［[^］]*］)/);
  return (
    <p className="polish-draft">
      {parts.map((p, i) => (p.startsWith('［') ? <mark key={i} className="ph">{p}</mark> : <Ruby key={i} text={p} />))}
    </p>
  );
}

/** 記録を整える：現場の下書きを、記録らしい書き方にする（端末の中だけで処理） */
export function Polish({ settings, onChange, onBack }: Props) {
  const lang = settings.lang;
  const [text, setText] = useState('');
  const [done, setDone] = useState<{ input: string; plain: boolean } | null>(null);
  const [msg, setMsg] = useState('');
  const result: PolishResult | null = useMemo(() => (done ? polish(done.input, { plain: done.plain }) : null), [done]);
  const plain = settings.polishPlain;

  const run = () => {
    setMsg('');
    setDone({ input: text, plain });
  };

  const copy = (s: string) =>
    navigator.clipboard?.writeText(s).then(
      () => setMsg(t(lang, 'copied')),
      () => setMsg(t(lang, 'copyManual')),
    ) ?? setMsg(t(lang, 'copyManual'));

  const nothing = result && !result.changes.length && !result.notes.length && !result.questions.length;

  return (
    <>
      <div className="card">
        <h2>📋 <Ruby text={t(lang, 'polishTitle')} /></h2>
        <p className="muted"><Ruby text={t(lang, 'polishIntro')} /></p>
        <div className="field">
          <label htmlFor="polish-input"><Ruby text={t(lang, 'polishInput')} /></label>
          <textarea id="polish-input" className="big" value={text} placeholder={`例：${EXAMPLE}`} onChange={(e) => setText(e.target.value)} />
          <div className="hint"><Ruby text={t(lang, 'polishNoName')} /></div>
        </div>
        <div className="setting-row">
          <span><Ruby text={t(lang, 'polishPlain')} /></span>
          <div className="seg">
            <button className={plain ? 'on' : ''} onClick={() => onChange({ ...settings, polishPlain: true })}>{t(lang, 'polishPlainOn')}</button>
            <button className={!plain ? 'on' : ''} onClick={() => onChange({ ...settings, polishPlain: false })}>{t(lang, 'polishPlainOff')}</button>
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={run} disabled={!text.trim()}>{t(lang, 'polishRun')}</button>
        </div>
        {!text && (
          <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setText(EXAMPLE)}>{t(lang, 'polishExample')}</button>
        )}
      </div>

      {result && (
        <>
          <div className="card">
            <h3><Ruby text={t(lang, 'polishDraft')} /></h3>
            <Draft text={result.draft} />
            {result.draft.includes('［') && <div className="muted"><Ruby text={t(lang, 'polishFill')} /></div>}
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <button className="btn secondary small" onClick={() => copy(result.draft)}>{t(lang, 'copy')}</button>
              <button className="btn ghost small" onClick={() => { setText(result.draft); setDone(null); window.scrollTo(0, 0); }}>{t(lang, 'polishEdit')}</button>
            </div>
            {msg && <div className="muted" style={{ marginTop: 6 }}>{msg}</div>}
          </div>

          {nothing && <div className="finding good">✓ <Ruby text={t(lang, 'polishGood')} /></div>}

          {result.changes.length > 0 && (
            <div className="card">
              <h3><Ruby text={t(lang, 'polishChanges')} /></h3>
              <ul className="check-list">
                {result.changes.map((c, i) => (
                  <li key={i}>
                    <span className="mark ok">✓</span>
                    <div>
                      <span className="polish-from">{c.from}</span> → <b>{c.to}</b>
                      <small><Ruby text={c.reason} /></small>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.notes.length > 0 && (
            <div className="card">
              <h3><Ruby text={t(lang, 'polishNotes')} /></h3>
              {result.notes.map((n, i) => (
                <div key={i} className={`finding ${n.kind === 'tense' || n.kind === 'name' ? 'info' : 'warn'}`}>
                  <Ruby text={n.message} />
                </div>
              ))}
            </div>
          )}

          {result.questions.length > 0 && (
            <div className="card">
              <h3><Ruby text={t(lang, 'polishQuestions')} /></h3>
              <ul className="check-list">
                {result.questions.map((q, i) => (
                  <li key={i}><span className="mark">❓</span><div><Ruby text={q} /></div></li>
                ))}
              </ul>
            </div>
          )}

          <p className="muted"><Ruby text={t(lang, 'polishDisclaimer')} /></p>
        </>
      )}

      <button className="btn ghost" style={{ marginTop: 8 }} onClick={onBack}>{t(lang, 'back')}</button>
    </>
  );
}
