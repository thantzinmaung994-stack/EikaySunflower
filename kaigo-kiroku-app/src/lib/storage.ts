import { Preferences } from '@capacitor/preferences';
import type { RecordEntry } from '../types';

const KEY = 'kaigo-kiroku:records';
const LANG_KEY = 'kaigo-kiroku:lang';

// ブラウザ上では Preferences が localStorage を使うので、Web でもそのまま動く
export async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const { value } = await Preferences.get({ key });
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  try {
    await Preferences.set({ key, value: JSON.stringify(value) });
  } catch {
    // 保存できない環境（プライベートブラウズなど）でもアプリは動かし続ける
  }
}

export const loadRecords = () => loadJson<RecordEntry[]>(KEY, []);
export const saveRecords = (records: RecordEntry[]) => saveJson(KEY, records);

export async function loadLang(): Promise<'ja' | 'my'> {
  try {
    const { value } = await Preferences.get({ key: LANG_KEY });
    return value === 'my' ? 'my' : 'ja';
  } catch {
    return 'ja';
  }
}

export async function saveLang(lang: 'ja' | 'my'): Promise<void> {
  try {
    await Preferences.set({ key: LANG_KEY, value: lang });
  } catch {
    // 無視
  }
}

/** すべての学習データを消す（設定画面の「データを消去」） */
export async function clearAll(): Promise<void> {
  try {
    const { keys } = await Preferences.keys();
    await Promise.all(keys.filter((k) => k.startsWith('kaigo-kiroku:')).map((key) => Preferences.remove({ key })));
  } catch {
    // 無視
  }
}

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
