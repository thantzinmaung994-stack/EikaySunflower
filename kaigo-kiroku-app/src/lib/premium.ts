import { Capacitor } from '@capacitor/core';
import { Purchases, type CustomerInfo, type PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { CORE_TERMS, type GlossaryTerm } from '../data/glossary';
import { BUILTIN_QUIZ, type FactItem } from '../data/factQuiz';
import type { Scenario } from '../types';

/**
 * 有料プラン（月額500円・自動更新）。
 * - 購入は App Store のアプリ内課金。管理は RevenueCat（レシート確認・解約・復元）。
 * - RevenueCat の「Entitlement」の ID は premium、App Store の商品は月額500円で作る（docs/課金の設定手順.md）。
 * - 公開用 SDK キーは .env の VITE_RC_IOS_KEY / VITE_RC_ANDROID_KEY（公開して問題ない種類のキー）。
 */
export const ENTITLEMENT = 'premium';

/** 無料で使える場面：各種類の1〜3本目（id が -01・-02・-03 のもの） */
export const isFreeScenario = (s: Pick<Scenario, 'id'>) => /-0[1-3]$/.test(s.id);

/**
 * 無料で使えるクイズ：約25%。事実・解釈それぞれの4問に1問（偏らないように）。
 * 講師が追加した問題はプレミアム。
 */
const FREE_QUIZ = new Set(
  (['fact', 'interp'] as const).flatMap((a) => BUILTIN_QUIZ.filter((q) => q.answer === a).filter((_, i) => i % 4 === 0).map((q) => q.id)),
);
export const isFreeQuiz = (q: Pick<FactItem, 'id'>) => FREE_QUIZ.has(q.id);

/** 用語の名前から 0〜99 の数を決める（毎回同じ値になる） */
function bucket(term: string): number {
  let h = 2166136261;
  for (const c of term) h = Math.imul(h ^ c.codePointAt(0)!, 16777619);
  return (h >>> 0) % 100;
}

/**
 * 無料で使える用語：約25%。介護記録の基本の用語（最初の161語）はすべて無料、
 * ほかは用語ごとに決まった約2割（グループにかたよらないよう、名前から決める）。
 */
export const isFreeTerm = (g: Pick<GlossaryTerm, 'term'>) => CORE_TERMS.has(g.term) || bucket(g.term) < 21;

const apiKey = () =>
  Capacitor.getPlatform() === 'ios'
    ? (import.meta.env.VITE_RC_IOS_KEY as string | undefined)
    : Capacitor.getPlatform() === 'android'
      ? (import.meta.env.VITE_RC_ANDROID_KEY as string | undefined)
      : undefined;

/** この端末で購入できるか（スマホアプリ版で、キーが設定されているとき） */
export const purchasesAvailable = () => Capacitor.isNativePlatform() && !!apiKey();

/** ブラウザの試用版で、有料部分の見た目を確かめるためのスイッチ（ストア版には出ない） */
export const previewToggleEnabled = () => !Capacitor.isNativePlatform() && import.meta.env.VITE_PREVIEW_PREMIUM === '1';

const isActive = (info: CustomerInfo) => !!info.entitlements.active[ENTITLEMENT];

let configured = false;
let ready: Promise<void> | null = null;
let notify: ((active: boolean) => void) | null = null;

/** 起動時に呼ぶ。購入状態が変わるたびに onChange が呼ばれる */
export function initPremium(onChange: (active: boolean) => void): Promise<void> {
  if (!purchasesAvailable()) return Promise.resolve();
  notify = onChange;
  ready ??= (async () => {
    try {
      await Purchases.configure({ apiKey: apiKey()! });
      configured = true;
      await Purchases.addCustomerInfoUpdateListener((info) => notify?.(isActive(info)));
      const { customerInfo } = await Purchases.getCustomerInfo();
      notify?.(isActive(customerInfo));
    } catch {
      // 通信できないときは前回の状態のまま（RevenueCat も端末に購入状態を保存している）
    }
  })();
  return ready;
}

export interface Plan {
  pkg: PurchasesPackage;
  price: string;
  /** 無料お試しの日数（App Store Connect で設定した場合） */
  trialDays: number;
}

export async function getPlan(): Promise<Plan | null> {
  // 起動直後に購入画面を開いても、準備が終わるのを待ってから料金を取りに行く
  await ready;
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.monthly ?? offerings.current?.availablePackages[0];
    if (!pkg) return null;
    const intro = pkg.product.introPrice;
    const unitDays: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };
    const trialDays = intro && intro.price === 0 ? intro.periodNumberOfUnits * (unitDays[intro.periodUnit] ?? 0) : 0;
    return { pkg, price: pkg.product.priceString, trialDays };
  } catch {
    return null;
  }
}

export type BuyResult = 'ok' | 'cancelled' | 'error';

export async function buy(plan: Plan): Promise<BuyResult> {
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: plan.pkg });
    const active = isActive(customerInfo);
    notify?.(active);
    return active ? 'ok' : 'error';
  } catch (e) {
    return (e as { userCancelled?: boolean })?.userCancelled ? 'cancelled' : 'error';
  }
}

/** 機種変更・再インストールのあとに使う「購入を復元」 */
export async function restore(): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    const active = isActive(customerInfo);
    notify?.(active);
    return active;
  } catch {
    return false;
  }
}

/** 受講生に配る App Store のオファーコードを入力する画面（iPhone のみ） */
export async function redeemCode(): Promise<void> {
  if (Capacitor.getPlatform() !== 'ios' || !configured) return;
  try {
    await Purchases.presentCodeRedemptionSheet();
  } catch {
    // 無視（コード入力画面は Apple が出す）
  }
}

export const canRedeemCode = () => Capacitor.getPlatform() === 'ios' && purchasesAvailable();

/** 解約・プラン変更は Apple の管理画面で行う */
export const MANAGE_URL = 'https://apps.apple.com/account/subscriptions';
