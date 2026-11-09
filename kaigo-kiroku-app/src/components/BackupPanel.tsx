import { useRef, useState } from 'react';
import { t } from '../i18n';
import { exportBackup, parseBackup, restoreBackup, type BackupFile } from '../lib/backup';
import type { Lang } from '../types';

/** 設定画面の「バックアップ」：書き出し（共有シート）と読み込み（ファイルまたは貼り付け） */
export function BackupPanel({ lang }: { lang: Lang }) {
  const [msg, setMsg] = useState<{ kind: 'good' | 'error' | 'info'; text: string } | null>(null);
  const [text, setText] = useState('');
  const [paste, setPaste] = useState('');
  const [pending, setPending] = useState<{ file: BackupFile; records: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onExport = async () => {
    setMsg(null);
    try {
      const r = await exportBackup();
      if (r.shared) setMsg({ kind: 'good', text: t(lang, 'backupShared') });
      else setText(r.text);
    } catch {
      setMsg({ kind: 'error', text: t(lang, 'backupFailed') });
    }
  };

  const check = (raw: string) => {
    const r = parseBackup(raw);
    if (!r.ok) {
      setPending(null);
      setMsg({ kind: 'error', text: r.reason });
      return;
    }
    setMsg(null);
    setPending({ file: r.file, records: r.records });
  };

  const onFile = async (f: File | undefined) => {
    if (f) check(await f.text());
    if (fileRef.current) fileRef.current.value = '';
  };

  const onRestore = async () => {
    if (!pending) return;
    await restoreBackup(pending.file);
    window.location.reload();
  };

  return (
    <div className="card">
      <h2>{t(lang, 'backup')}</h2>
      <div className="muted" style={{ marginBottom: 8 }}>{t(lang, 'backupNote')}</div>
      <div className="row">
        <button className="btn secondary" onClick={onExport}>⬆ {t(lang, 'backupExport')}</button>
        <button className="btn secondary" onClick={() => fileRef.current?.click()}>⬇ {t(lang, 'backupImport')}</button>
      </div>
      <input ref={fileRef} id="backup-file" type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />

      {text && (
        <div className="field" style={{ marginTop: 10 }}>
          <label htmlFor="backup-text">{t(lang, 'backupCopy')}</label>
          <textarea id="backup-text" readOnly value={text} onFocus={(e) => e.target.select()} />
          <button
            className="btn ghost small"
            style={{ marginTop: 6 }}
            onClick={() => navigator.clipboard?.writeText(text).then(() => setMsg({ kind: 'good', text: t(lang, 'copied') }), () => setMsg({ kind: 'info', text: t(lang, 'copyManual') }))}
          >
            📋 {t(lang, 'copy')}
          </button>
        </div>
      )}

      <details style={{ marginTop: 10 }}>
        <summary className="muted">{t(lang, 'backupPaste')}</summary>
        <div className="field" style={{ marginTop: 6 }}>
          <textarea id="backup-paste" value={paste} onChange={(e) => setPaste(e.target.value)} />
          <button className="btn ghost small" style={{ marginTop: 6 }} onClick={() => check(paste)} disabled={!paste.trim()}>{t(lang, 'check')}</button>
        </div>
      </details>

      {pending && (
        <div style={{ marginTop: 10 }}>
          <div className="finding warn">{t(lang, 'backupConfirm').replace('{n}', String(pending.records)).replace('{d}', new Date(pending.file.exportedAt).toLocaleString('ja-JP'))}</div>
          <div className="row">
            <button className="btn ghost" onClick={() => setPending(null)}>{t(lang, 'back')}</button>
            <button className="btn" onClick={() => void onRestore()}>{t(lang, 'backupRestore')}</button>
          </div>
        </div>
      )}
      {msg && <div className={`finding ${msg.kind}`} style={{ marginTop: 10 }}>{msg.text}</div>}
    </div>
  );
}
