import { Capacitor } from '@capacitor/core';
import { Purchases, type CustomerInfo, type PurchasesPackage } from '@revenuecat/purchases-capacitor';
import type { Scenario } from '../types';

/**
 * 有料プラン（月額500円・自動更新）。
 * - 購入は App Store のアプリ内課金。管理は RevenueCat（レシート確認・解約・復元）。
 * - RevenueCat の「Entitlement」の ID は premium、App Store の商品は月額500円で作る（docs/課金の設定手順.md）。
 * - 公開用 SDK キーは .env の VITE_RC_IOS_KEY / VITE_RC_ANDROID_KEY（公開して問題ない種類のキー）。
 */
export const ENTITLEMENT = 'premium';

/** 無料で使える場面：各種類の1本目（id が -01 のもの） */
export const isFreeScenario = (s: Pick<Scenario, 'id'>) => s.id.endsWith('-01');

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

/** 起動時に呼ぶ。購入状態が変わるたびに onChange が呼ばれる */
export async function initPremium(onChange: (active: boolean) => void): Promise<void> {
  if (!purchasesAvailable() || configured) return;
  try {
    await Purchases.configure({ apiKey: apiKey()! });
    configured = true;
    await Purchases.addCustomerInfoUpdateListener((info) => onChange(isActive(info)));
    const { customerInfo } = await Purchases.getCustomerInfo();
    onChange(isActive(customerInfo));
  } catch {
    // 通信できないときは前回の状態のまま（RevenueCat も端末に購入状態を保存している）
  }
}

export interface Plan {
  pkg: PurchasesPackage;
  price: string;
  /** 無料お試しの日数（App Store Connect で設定した場合） */
  trialDays: number;
}

export async function getPlan(): Promise<Plan | null> {
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
    return isActive(customerInfo) ? 'ok' : 'error';
  } catch (e) {
    return (e as { userCancelled?: boolean })?.userCancelled ? 'cancelled' : 'error';
  }
}

/** 機種変更・再インストールのあとに使う「購入を復元」 */
export async function restore(): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return isActive(customerInfo);
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
