/**
 * 日本語の読み上げ。端末に入っている音声（Web Speech API）を使うので、通信も費用もかからない。
 * iPhone・Android の WebView、パソコンのブラウザで動く。使えない端末ではボタンを出さない。
 */
import { MANUAL_RUBY } from '../data/yomi';

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let jaVoice: SpeechSynthesisVoice | null | undefined;
function voice(): SpeechSynthesisVoice | null {
  if (jaVoice !== undefined && jaVoice !== null) return jaVoice;
  const vs = window.speechSynthesis.getVoices();
  jaVoice = vs.find((v) => v.lang === 'ja-JP') ?? vs.find((v) => v.lang.startsWith('ja')) ?? null;
  return jaVoice;
}

/** 読み上げる。同じボタンをもう一度押すと止まる（呼び出し側で stop を使う） */
export function speak(text: string, rate = 0.9, onEnd?: () => void): void {
  if (!speechSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  // 手動ルビ「漢字《よみ》」は読みのほうを読ませる。記号は読まない
  const clean = text.replace(MANUAL_RUBY, '$2').replace(/[「」『』【】→✕○]/g, ' ');
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = 'ja-JP';
  u.rate = rate;
  const v = voice();
  if (v) u.voice = v;
  if (onEnd) u.onend = u.onerror = () => onEnd();
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}
