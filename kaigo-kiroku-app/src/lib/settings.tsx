import { createContext, useContext } from 'react';
import type { Lang } from '../types';
import { loadJson, saveJson } from './storage';

export interface Settings {
  lang: Lang;
  /** ふりがなを表示する */
  furigana: boolean;
  /** 毎日の練習のお知らせ */
  reminder: { on: boolean; hour: number; minute: number };
  /** 1日の目標（場面の数） */
  dailyGoal: number;
  /** 読み上げの速さ（0.7＝ゆっくり、0.9＝ふつう） */
  speechRate: number;
  /** 初回の使い方を見たか */
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'ja',
  furigana: true,
  reminder: { on: false, hour: 20, minute: 0 },
  dailyGoal: 1,
  speechRate: 0.9,
  onboarded: false,
};

const KEY = 'kaigo-kiroku:settings';

export async function loadSettings(legacyLang: Lang): Promise<Settings> {
  const s = await loadJson<Partial<Settings>>(KEY, {});
  // 以前のバージョンは言語だけを別キーに保存していた
  return { ...DEFAULT_SETTINGS, lang: legacyLang, ...s, reminder: { ...DEFAULT_SETTINGS.reminder, ...s.reminder } };
}

export const saveSettings = (s: Settings) => saveJson(KEY, s);

export const SettingsContext = createContext<Settings>(DEFAULT_SETTINGS);
export const useSettings = () => useContext(SettingsContext);
