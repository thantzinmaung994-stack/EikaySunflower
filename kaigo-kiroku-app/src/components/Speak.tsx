import { useEffect, useState } from 'react';
import { useSettings } from '../lib/settings';
import { speak, speechSupported, stopSpeaking } from '../lib/speech';

/** 🔊 ボタン。押すと日本語で読み上げ、もう一度押すと止まる */
export function Speak({ text, label = '読み上げ' }: { text: string; label?: string }) {
  const { speechRate, speechVoice } = useSettings();
  const [on, setOn] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  if (!speechSupported() || !text) return null;
  return (
    <button
      type="button"
      className={`speak${on ? ' on' : ''}`}
      aria-label={label}
      aria-pressed={on}
      onClick={(e) => {
        e.stopPropagation();
        if (on) {
          stopSpeaking();
          setOn(false);
        } else {
          setOn(true);
          speak(text, speechRate, () => setOn(false), speechVoice);
        }
      }}
    >
      {on ? '⏹' : '🔊'}
    </button>
  );
}
