import { useState } from 'react';
import { my } from '../lib/myanmar';
import type { Finding, Lang } from '../types';
import { Ruby } from './Ruby';

/** ミャンマー語の説明を開くボタンの文字（日本語の画面でも、ミャンマー語で出す） */
const OPEN_MY = 'မြန်မာလို ရှင်းပြပါ';
const CLOSE_MY = 'ပိတ်ရန်';

/** 指摘のミャンマー語の説明（訳がなければ undefined） */
export const findingMy = (f: Finding) => {
  const s = f.textKey ? my(`finding.${f.textKey}`) : undefined;
  return s?.replace('{w}', f.match ?? '');
};

/**
 * 採点の指摘1件。日本語で出し、「မြန်မာလို ရှင်းပြပါ」でミャンマー語の説明を開く。
 * 画面をミャンマー語にしているときは、はじめから開いておく。
 */
export function FindingRow({ f, lang, tone }: { f: Finding; lang: Lang; tone?: Finding['severity'] }) {
  const mm = findingMy(f);
  const [open, setOpen] = useState(lang === 'my');
  return (
    <div className={`finding ${tone ?? f.severity}`}>
      <span className="part">{f.part}</span>
      <div style={{ flex: 1 }}>
        {f.match ? (
          <>
            <mark>{f.match}</mark> <Ruby text={f.message.replace(`「${f.match}」`, '')} />
          </>
        ) : (
          <Ruby text={f.message} />
        )}
        {f.suggestion && <span className="sug">→ <Ruby text={f.suggestion} /></span>}
        {mm && (
          <>
            <button type="button" className="my-explain-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              🇲🇲 {open ? CLOSE_MY : OPEN_MY}
            </button>
            {open && <p className="my-explain" lang="my">{mm}</p>}
          </>
        )}
      </div>
    </div>
  );
}
