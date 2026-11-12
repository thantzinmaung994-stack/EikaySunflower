import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { bestVoice, listJaVoices, speak, type JaVoice } from '../lib/speech';
import type { Settings } from '../lib/settings';

/** 読み上げの声を選ぶ（設定画面）。端末にある日本語の声から選び、その場で試せる */
export function VoicePicker({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const lang = settings.lang;
  const [voices, setVoices] = useState<JaVoice[]>([]);

  useEffect(() => {
    // 設定画面を開くたびに読み直す（iPhone の設定で声をダウンロードしたあとに反映させるため）
    void listJaVoices(true).then(setVoices);
  }, []);

  const label = (v: JaVoice) =>
    [
      v.name,
      v.quality !== 'standard' ? t(lang, 'voiceHigh') : '',
      v.gender ? t(lang, v.gender === 'female' ? 'voiceFemale' : 'voiceMale') : '',
    ]
      .filter(Boolean)
      .join('・');

  const auto = bestVoice(voices);
  const chosen = voices.some((v) => v.id === settings.speechVoice) ? settings.speechVoice : '';

  return (
    <div className="voice-picker">
      <div className="setting-row">
        <label htmlFor="speech-voice">🗣 {t(lang, 'speechVoice')}</label>
        <div className="voice-controls">
          <select id="speech-voice" value={chosen} onChange={(e) => onChange({ ...settings, speechVoice: e.target.value })}>
            <option value="">
              {t(lang, 'voiceAuto')}
              {auto ? `：${label(auto)}` : ''}
            </option>
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {label(v)}
              </option>
            ))}
          </select>
          <button type="button" className="btn ghost small" onClick={() => speak(t('ja', 'voiceSample'), settings.speechRate, undefined, chosen)}>
            🔊 {t(lang, 'voiceTry')}
          </button>
        </div>
      </div>
      <div className="muted voice-hint">{t(lang, 'voiceHint')}</div>
    </div>
  );
}
