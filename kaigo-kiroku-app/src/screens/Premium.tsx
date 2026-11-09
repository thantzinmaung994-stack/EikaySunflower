import { useEffect, useState } from 'react';
import { Ruby } from '../components/Ruby';
import { PRICE } from '../data/info';
import { GLOSSARY } from '../data/glossary';
import { SCENARIOS } from '../data/scenarios';
import { t } from '../i18n';
import {
  buy, canRedeemCode, getPlan, isFreeScenario, isFreeTerm, MANAGE_URL, previewToggleEnabled, purchasesAvailable, redeemCode, restore, type Plan,
} from '../lib/premium';
import type { Lang } from '../types';

interface Props {
  lang: Lang;
  premium: boolean;
  onPreviewToggle: (on: boolean) => void;
  onOpenInfo: (id: 'terms' | 'privacy') => void;
  onBack: () => void;
}

export function Premium({ lang, premium, onPreviewToggle, onOpenInfo, onBack }: Props) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'good' | 'error' | 'info'; text: string } | null>(null);
  const free = SCENARIOS.filter(isFreeScenario).length;
  const total = SCENARIOS.length;
  const freeT = GLOSSARY.filter(isFreeTerm).length;

  useEffect(() => {
    if (purchasesAvailable()) void getPlan().then(setPlan);
  }, []);

  const price = plan?.price ?? `¥${PRICE.monthly}`;
  const trial = plan?.trialDays ?? 0;

  const onBuy = async () => {
    if (!plan) return;
    setBusy(true);
    setMsg(null);
    const r = await buy(plan);
    setBusy(false);
    if (r === 'ok') setMsg({ kind: 'good', text: t(lang, 'buyDone') });
    else if (r === 'error') setMsg({ kind: 'error', text: t(lang, 'buyError') });
  };

  const onRestore = async () => {
    setBusy(true);
    setMsg(null);
    const ok = await restore();
    setBusy(false);
    setMsg(ok ? { kind: 'good', text: t(lang, 'restoreDone') } : { kind: 'info', text: t(lang, 'restoreNone') });
  };

  return (
    <>
      <div className="card hero premium-hero">
        <div className="eyebrow light">PREMIUM</div>
        <h1>{t(lang, 'premiumTitle')}</h1>
        <div className="price">
          <b>{price}</b>
          <span>/ {t(lang, 'perMonth')}</span>
        </div>
        {trial > 0 && !premium && <div className="trial">{trial}{t(lang, 'trialDays')}</div>}
      </div>

      <div className="card">
        <ul className="check-list">
          <li><span className="mark ok">✓</span><div><Ruby text={`${t(lang, 'benefitScenes')}（${total}${t(lang, 'scenesUnit')}）`} /><small><Ruby text={`${t(lang, 'freeNote')} ${free}${t(lang, 'scenesUnit')}`} /></small></div></li>
          <li><span className="mark ok">✓</span><div><Ruby text={`${t(lang, 'benefitQuiz')}`} /><small>{t(lang, 'freeQuizShort')}</small></div></li>
          <li><span className="mark ok">✓</span><div><Ruby text={`${t(lang, 'benefitTerms')}（${GLOSSARY.length}${t(lang, 'termsUnit')}）`} /><small>{t(lang, 'freeTermsNote').split('（')[0].replace('{free}', String(freeT))}</small></div></li>
          <li><span className="mark ok">✓</span><div><Ruby text={t(lang, 'benefitNew')} /></div></li>
          <li><span className="mark ok">✓</span><div><Ruby text={t(lang, 'benefitReview')} /></div></li>
          <li><span className="mark ok">✓</span><div><Ruby text={t(lang, 'benefitFree')} /></div></li>
        </ul>
      </div>

      {msg && <div className={`finding ${msg.kind}`}>{msg.text}</div>}

      {premium ? (
        <div className="card">
          <div className="finding good">✓ {t(lang, 'youArePremium')}</div>
          {purchasesAvailable() && (
            <a className="btn secondary" href={MANAGE_URL} target="_blank" rel="noreferrer">{t(lang, 'manageSub')}</a>
          )}
        </div>
      ) : purchasesAvailable() ? (
        <>
          <button className="btn gold" onClick={onBuy} disabled={busy || !plan}>
            {busy ? '…' : trial > 0 ? t(lang, 'startTrial') : t(lang, 'subscribe')}
          </button>
          {!plan && !busy && <div className="muted" style={{ marginTop: 6 }}>{t(lang, 'planLoading')}</div>}
        </>
      ) : (
        <div className="finding info">{t(lang, 'buyInApp')}</div>
      )}

      {purchasesAvailable() && (
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn ghost" onClick={onRestore} disabled={busy}>{t(lang, 'restore')}</button>
          {canRedeemCode() && <button className="btn ghost" onClick={() => void redeemCode()} disabled={busy}>{t(lang, 'redeemCode')}</button>}
        </div>
      )}

      {/* App Store の審査で必要な表示：料金・期間・自動更新・解約方法・規約とプライバシーへのリンク */}
      <div className="legal">
        <p>
          {t(lang, 'legal1').replace('{price}', price)}
          {trial > 0 ? ` ${t(lang, 'legalTrial').replace('{days}', String(trial))}` : ''}
        </p>
        <p>{t(lang, 'legal2')}</p>
        <p>
          <button className="link" onClick={() => onOpenInfo('terms')}>{t(lang, 'termsLink')}</button>
          {' ・ '}
          <button className="link" onClick={() => onOpenInfo('privacy')}>{t(lang, 'privacy')}</button>
        </p>
      </div>

      {previewToggleEnabled() && (
        <div className="card preview-box">
          <div className="muted">{t(lang, 'previewNote')}</div>
          <button className="btn ghost small" onClick={() => onPreviewToggle(!premium)}>
            {premium ? t(lang, 'previewOff') : t(lang, 'previewOn')}
          </button>
        </div>
      )}

      <button className="btn ghost" style={{ marginTop: 8 }} onClick={onBack}>{t(lang, 'back')}</button>
    </>
  );
}
