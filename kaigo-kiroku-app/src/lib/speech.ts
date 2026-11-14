/**
 * 日本語の読み上げ。端末に入っている音声を使うので、通信も費用もかからない。
 * - iPhone・Android のアプリ版：端末の読み上げ機能（@capacitor-community/text-to-speech）。
 *   アプリの中では Web Speech API が鳴らないことがあるため、こちらを使う。
 * - ブラウザ版：Web Speech API。使えないブラウザではボタンを出さない。
 * 声は設定で選べる。選んでいないときは、端末にある日本語の声のうち、いちばん自然なもの（高音質・女性を優先）を使う。
 */
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { MANUAL_RUBY } from '../data/yomi';

const native = () => Capacitor.isNativePlatform();
const webSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

export const speechSupported = () => native() || webSupported();

export type VoiceQuality = 'premium' | 'enhanced' | 'standard';

export interface JaVoice {
  /** 端末の声のID（iPhone は com.apple.voice.enhanced.ja-JP.Kyoko など） */
  id: string;
  name: string;
  quality: VoiceQuality;
  gender?: 'female' | 'male';
  /** アプリ版で speak に渡す番号（端末の声の一覧での位置） */
  index: number;
}

// iPhone の日本語の声（名前で判別できるもの）
const FEMALE = /kyoko|o-?ren|sakura|ayumi|haruka|nanami|mizuki|female|女性/i;
const MALE = /otoya|hattori|ichiro|keita|male|男性/i;

export function voiceQuality(id: string, name = ''): VoiceQuality {
  const s = `${id} ${name}`;
  if (/premium|プレミアム/i.test(s)) return 'premium';
  if (/enhanced|拡張|natural|neural|online/i.test(s)) return 'enhanced';
  return 'standard';
}

export function voiceGender(id: string, name: string): JaVoice['gender'] {
  const s = `${id} ${name}`;
  if (FEMALE.test(s)) return 'female';
  if (MALE.test(s)) return 'male';
  return undefined;
}

const RANK: Record<VoiceQuality, number> = { premium: 3, enhanced: 2, standard: 1 };

/** いちばん自然な声：高音質を優先し、同じ音質なら女性の声 */
export function bestVoice(vs: JaVoice[]): JaVoice | undefined {
  return [...vs].sort(
    (a, b) => RANK[b.quality] - RANK[a.quality] || Number(b.gender === 'female') - Number(a.gender === 'female'),
  )[0];
}

function toJa(list: { lang: string; name: string; voiceURI: string }[]): JaVoice[] {
  const out: JaVoice[] = [];
  const seen = new Set<string>();
  list.forEach((v, index) => {
    if (!v.lang.replace('_', '-').toLowerCase().startsWith('ja') || seen.has(v.voiceURI)) return;
    seen.add(v.voiceURI);
    out.push({ id: v.voiceURI, name: v.name, quality: voiceQuality(v.voiceURI, v.name), gender: voiceGender(v.voiceURI, v.name), index });
  });
  return out;
}

let cache: JaVoice[] | null = null;

function webVoices(): Promise<SpeechSynthesisVoice[]> {
  const now = window.speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  // 声の一覧はあとから読み込まれることがある
  return new Promise((res) => {
    const done = () => res(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

/** 端末にある日本語の声の一覧（設定画面で選ぶ） */
export async function listJaVoices(refresh = false): Promise<JaVoice[]> {
  if (cache && !refresh) return cache;
  try {
    if (native()) cache = toJa((await TextToSpeech.getSupportedVoices()).voices);
    else if (webSupported()) cache = toJa(await webVoices());
    else cache = [];
  } catch {
    cache = [];
  }
  return cache;
}

async function pick(voiceId: string): Promise<JaVoice | undefined> {
  const vs = await listJaVoices();
  return vs.find((v) => v.id === voiceId) ?? bestVoice(vs);
}

/** 手動ルビ「漢字《よみ》」は読みのほうを読ませる。記号は読まない */
export const speechText = (text: string) => text.replace(MANUAL_RUBY, '$2').replace(/[「」『』【】→✕○]/g, ' ');

/** 読み上げる。voiceId が空なら、いちばん自然な声。同じボタンをもう一度押すと止まる（呼び出し側で stop を使う） */
export function speak(text: string, rate = 0.9, onEnd?: () => void, voiceId = ''): void {
  const clean = speechText(text);
  if (native()) {
    // 読み終わり・中断・失敗のどれでも onEnd を呼ぶ
    void pick(voiceId)
      .then((v) => TextToSpeech.speak({ text: clean, lang: 'ja-JP', rate, category: 'playback', ...(v ? { voice: v.index } : {}) }))
      .catch(() => undefined)
      .finally(() => onEnd?.());
    return;
  }
  if (!webSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  void pick(voiceId).then((v) => {
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'ja-JP';
    u.rate = rate;
    const wv = v && synth.getVoices().find((x) => x.voiceURI === v.id);
    try {
      if (wv) u.voice = wv;
    } catch {
      // 声を指定できないブラウザでは既定の日本語の声で読む
    }
    if (onEnd) u.onend = u.onerror = () => onEnd();
    synth.speak(u);
  });
}

export function stopSpeaking(): void {
  if (native()) {
    void TextToSpeech.stop().catch(() => undefined);
    return;
  }
  if (webSupported()) window.speechSynthesis.cancel();
}
