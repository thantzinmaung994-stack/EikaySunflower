import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const ID = 1001;

/** 通知はスマホアプリ版だけ（ブラウザ版では設定を出さない） */
export const remindersSupported = () => Capacitor.isNativePlatform();

/**
 * 毎日決まった時刻に「今日の練習」のお知らせを出す。
 * 戻り値は、実際に予約できたかどうか（通知が許可されなかったら false）。
 */
export async function applyReminder(on: boolean, hour: number, minute: number): Promise<boolean> {
  if (!remindersSupported()) return false;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ID }] });
    if (!on) return true;
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return false;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: ID,
          title: '今日の記録練習',
          body: '1つの場面で5分。連続記録をのばしましょう。',
          schedule: { on: { hour, minute }, allowWhileIdle: true },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}
