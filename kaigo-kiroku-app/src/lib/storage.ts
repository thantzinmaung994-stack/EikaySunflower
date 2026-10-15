import { Preferences } from '@capacitor/preferences';
import type { RecordEntry } from '../types';

const KEY = 'kaigo-kiroku:records';
const LANG_KEY = 'kaigo-kiroku:lang';

// ブラウザ上では Preferences が localStorage を使うので、Web でもそのまま動く
export async function loadRecords(): Promise<RecordEntry[]> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    return value ? (JSON.parse(value) as RecordEntry[]) : [];
  } catch {
    return [];
  }
}

export async function saveRecords(records: RecordEntry[]): Promise<void> {
  await Preferences.set({ key: KEY, value: JSON.stringify(records) });
}

export async function loadLang(): Promise<'ja' | 'my'> {
  const { value } = await Preferences.get({ key: LANG_KEY });
  return value === 'my' ? 'my' : 'ja';
}

export async function saveLang(lang: 'ja' | 'my'): Promise<void> {
  await Preferences.set({ key: LANG_KEY, value: lang });
}

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
