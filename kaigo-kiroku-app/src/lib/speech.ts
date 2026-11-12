/**
 * 日本語の読み上げ。端末に入っている音声を使うので、通信も費用もかからない。
 * - iPhone・Android のアプリ版：端末の読み上げ機能（@capacitor-community/text-to-speech）。
 *   アプリの中では Web Speech API が鳴らないことがあるため、こちらを使う。
 * - ブラウザ版：Web Speech API。使えないブラウザではボタンを出さない。
 */
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { MANUAL_RUBY } from '../data/yomi';

const native = () => Capacitor.isNativePlatform();
const webSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

export const speechSupported = () => native() || webSupported();

let jaVoice: SpeechSynthesisVoice | null | undefined;
function voice(): SpeechSynthesisVoice | null {
  if (jaVoice !== undefined && jaVoice !== null) return jaVoice;
  const vs = window.speechSynthesis.getVoices();
  jaVoice = vs.find((v) => v.lang === 'ja-JP') ?? vs.find((v) => v.lang.startsWith('ja')) ?? null;
  return jaVoice;
}

/** 手動ルビ「漢字《よみ》」は読みのほうを読ませる。記号は読まない */
export const speechText = (text: string) => text.replace(MANUAL_RUBY, '$2').replace(/[「」『』【】→✕○]/g, ' ');

/** 読み上げる。同じボタンをもう一度押すと止まる（呼び出し側で stop を使う） */
export function speak(text: string, rate = 0.9, onEnd?: () => void): void {
  const clean = speechText(text);
  if (native()) {
    // 読み終わり・中断・失敗のどれでも onEnd を呼ぶ
    TextToSpeech.speak({ text: clean, lang: 'ja-JP', rate, category: 'playback' })
      .catch(() => undefined)
      .finally(() => onEnd?.());
    return;
  }
  if (!webSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = 'ja-JP';
  u.rate = rate;
  const v = voice();
  if (v) u.voice = v;
  if (onEnd) u.onend = u.onerror = () => onEnd();
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (native()) {
    void TextToSpeech.stop().catch(() => undefined);
    return;
  }
  if (webSupported()) window.speechSynthesis.cancel();
}
