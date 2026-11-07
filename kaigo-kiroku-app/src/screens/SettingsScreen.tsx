import { useState } from 'react';
import { INFO_PAGES, type InfoPage } from '../data/info';
import { t } from '../i18n';
import { applyReminder, remindersSupported } from '../lib/reminder';
import type { Settings } from '../lib/settings';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onOpenInfo: (id: InfoPage['id']) => void;
  onClearData: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function SettingsScreen({ settings, onChange, onOpenInfo, onClearData }: Props) {
  const lang = settings.lang;
  const [confirmClear, setConfirmClear] = useState(false);
  const [reminderMsg, setReminderMsg] = useState('');

  const setReminder = async (r: Settings['reminder']) => {
    const ok = await applyReminder(r.on, r.hour, r.minute);
    if (r.on && !ok) {
      setReminderMsg(t(lang, 'notifDenied'));
      onChange({ ...settings, reminder: { ...r, on: false } });
      return;
    }
    setReminderMsg(r.on ? `${t(lang, 'notifSet')} ${pad(r.hour)}:${pad(r.minute)}` : '');
    onChange({ ...settings, reminder: r });
  };

  return (
    <>
      <div className="card">
        <h2>{t(lang, 'settings')}</h2>
        <div className="setting-row">
          <span>🌐 {t(lang, 'language')}</span>
          <div className="seg">
            {(['ja', 'my'] as const).map((l) => (
              <button key={l} className={settings.lang === l ? 'on' : ''} onClick={() => onChange({ ...settings, lang: l })}>
                {l === 'ja' ? '日本語' : 'မြန်မာ'}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <span>あ {t(lang, 'furigana')}</span>
          <div className="seg">
            <button className={settings.furigana ? 'on' : ''} onClick={() => onChange({ ...settings, furigana: true })}>ON</button>
            <button className={!settings.furigana ? 'on' : ''} onClick={() => onChange({ ...settings, furigana: false })}>OFF</button>
          </div>
        </div>
        <div className="setting-row">
          <span>🎯 {t(lang, 'dailyGoal')}</span>
          <div className="seg">
            {[1, 2, 3].map((n) => (
              <button key={n} className={settings.dailyGoal === n ? 'on' : ''} onClick={() => onChange({ ...settings, dailyGoal: n })}>
                {n}
              </button>
            ))}
          </div>
        </div>
        {remindersSupported() && (
          <>
            <div className="setting-row">
              <span>🔔 {t(lang, 'reminder')}</span>
              <div className="seg">
                <button className={settings.reminder.on ? 'on' : ''} onClick={() => setReminder({ ...settings.reminder, on: true })}>ON</button>
                <button className={!settings.reminder.on ? 'on' : ''} onClick={() => setReminder({ ...settings.reminder, on: false })}>OFF</button>
              </div>
            </div>
            {settings.reminder.on && (
              <div className="setting-row">
                <span>⏰ {t(lang, 'reminderTime')}</span>
                <input
                  id="reminder-time"
                  type="time"
                  value={`${pad(settings.reminder.hour)}:${pad(settings.reminder.minute)}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number);
                    if (!Number.isNaN(h)) void setReminder({ on: true, hour: h, minute: m || 0 });
                  }}
                />
              </div>
            )}
            {reminderMsg && <div className="muted">{reminderMsg}</div>}
          </>
        )}
      </div>

      <div className="card">
        <h2>{t(lang, 'appInfo')}</h2>
        {INFO_PAGES.map((p) => (
          <button key={p.id} className="list-item" onClick={() => onOpenInfo(p.id)}>
            <span className="ico">{p.icon}</span>
            <div className="body"><b>{p.title}</b></div>
            <span className="muted">›</span>
          </button>
        ))}
      </div>

      <div className="card">
        <h2>{t(lang, 'data')}</h2>
        <div className="muted" style={{ marginBottom: 8 }}>{t(lang, 'dataNote')}</div>
        {confirmClear ? (
          <>
            <div className="finding error">{t(lang, 'confirmClear')}</div>
            <div className="row">
              <button className="btn ghost" onClick={() => setConfirmClear(false)}>{t(lang, 'back')}</button>
              <button className="btn" style={{ background: 'var(--error)' }} onClick={() => { onClearData(); setConfirmClear(false); }}>
                {t(lang, 'clearData')}
              </button>
            </div>
          </>
        ) : (
          <button className="btn ghost" style={{ color: 'var(--error)' }} onClick={() => setConfirmClear(true)}>🗑 {t(lang, 'clearData')}</button>
        )}
      </div>
    </>
  );
}

export function InfoView({ page, onBack, backLabel }: { page: InfoPage; onBack: () => void; backLabel: string }) {
  return (
    <>
      <div className="card info-page">
        <h2>{page.icon} {page.title}</h2>
        {page.sections.map((s, i) => (
          <section key={i}>
            {s.h && <h3>{s.h}</h3>}
            {s.p.length > 1 ? (
              <ul className="lesson-body">{s.p.map((x) => <li key={x}>{x}</li>)}</ul>
            ) : (
              <p>{s.p[0]}</p>
            )}
          </section>
        ))}
      </div>
      <button className="btn ghost" onClick={onBack}>{backLabel}</button>
    </>
  );
}
