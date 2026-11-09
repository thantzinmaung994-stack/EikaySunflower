/**
 * 学習データのバックアップ（機種変更のとき用）。
 * 端末に保存している kaigo-kiroku:* をすべて1つの JSON ファイルにして、共有シートで保存・送信する。
 * 有料プランの購入は Apple 側にあるので、ここには入らない（新しい端末で「購入を復元」）。
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';

const PREFIX = 'kaigo-kiroku:';
const APP = 'com.eikaysunflower.kaigokiroku';

export interface BackupFile {
  app: typeof APP;
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
}

export async function makeBackup(): Promise<BackupFile> {
  const { keys } = await Preferences.keys();
  const data: Record<string, string> = {};
  for (const key of keys.filter((k) => k.startsWith(PREFIX) && !k.endsWith('preview-premium'))) {
    const { value } = await Preferences.get({ key });
    if (value !== null) data[key] = value;
  }
  return { app: APP, version: 1, exportedAt: new Date().toISOString(), data };
}

export const backupFileName = (d = new Date()) =>
  `kaigo-kiroku-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;

/**
 * スマホ版：ファイルを作って共有シートを出す（「ファイルに保存」・AirDrop・メールなど）。
 * ブラウザ版：ダウンロードできない環境もあるので、文字として返して画面に表示する。
 */
export async function exportBackup(): Promise<{ shared: boolean; text: string }> {
  const text = JSON.stringify(await makeBackup());
  if (!Capacitor.isNativePlatform()) return { shared: false, text };
  const path = backupFileName();
  await Filesystem.writeFile({ path, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  await Share.share({ title: '介護記録トレーニングのバックアップ', files: [uri] });
  return { shared: true, text };
}

/** 読み込む前に中身を確かめる。問題があれば理由を返す */
export function parseBackup(text: string): { ok: true; file: BackupFile; records: number } | { ok: false; reason: string } {
  let file: BackupFile;
  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'ファイルを読めませんでした。このアプリで書き出したバックアップファイルを選んでください。' };
  }
  if (file?.app !== APP || file.version !== 1 || typeof file.data !== 'object') {
    return { ok: false, reason: 'このアプリのバックアップファイルではありません。' };
  }
  if (Object.keys(file.data).some((k) => !k.startsWith(PREFIX))) {
    return { ok: false, reason: 'ファイルの中身が正しくありません。' };
  }
  let records = 0;
  try {
    records = JSON.parse(file.data[`${PREFIX}records`] ?? '[]').length;
  } catch {
    return { ok: false, reason: '記録のデータが壊れています。' };
  }
  return { ok: true, file, records };
}

/** 今のデータを置き換える（呼んだあとはアプリを読み込み直す） */
export async function restoreBackup(file: BackupFile): Promise<void> {
  const { keys } = await Preferences.keys();
  await Promise.all(keys.filter((k) => k.startsWith(PREFIX)).map((key) => Preferences.remove({ key })));
  for (const [key, value] of Object.entries(file.data)) await Preferences.set({ key, value });
}
