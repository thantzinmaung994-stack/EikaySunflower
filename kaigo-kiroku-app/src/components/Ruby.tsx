import { Fragment, type ReactNode } from 'react';
import { BASE_YOMI, MANUAL_RUBY } from '../data/yomi';
import { GLOSSARY } from '../data/glossary';
import { useSettings } from '../lib/settings';

const KANJI = /[一-鿿㐀-䶿々〆ヶ]/;
const HIRAGANA_ONLY = /^[ぁ-ゟー]+$/;

// 用語辞典の読みも使う（ひらがなの読みで、漢字を含む2文字以上の語だけ。
// 1文字の語を入れると「便」→「便利」のように別の語の一部にも付いてしまうため）
const YOMI: Record<string, string> = { ...BASE_YOMI };
for (const g of GLOSSARY) {
  if (g.term.length >= 2 && KANJI.test(g.term) && HIRAGANA_ONLY.test(g.yomi) && !/[A-Za-z0-9（）()・/]/.test(g.term)) YOMI[g.term] ??= g.yomi;
}
// 先頭の文字ごとに、長い語から並べておく（3000語でも速く探せるように）
const BY_FIRST = new Map<string, string[]>();
for (const k of Object.keys(YOMI)) {
  const list = BY_FIRST.get(k[0]) ?? [];
  list.push(k);
  BY_FIRST.set(k[0], list);
}
BY_FIRST.forEach((list) => list.sort((a, b) => b.length - a.length));

type Piece = string | { base: string; rt: string };

/** 自動ルビ：辞書の最長一致。辞書にない漢字はそのまま（誤読を見せない） */
export function autoRuby(text: string): Piece[] {
  const out: Piece[] = [];
  let buf = '';
  let i = 0;
  while (i < text.length) {
    if (KANJI.test(text[i])) {
      const key = BY_FIRST.get(text[i])?.find((k) => text.startsWith(k, i));
      if (key) {
        if (buf) out.push(buf), (buf = '');
        out.push({ base: key, rt: YOMI[key] });
        i += key.length;
        continue;
      }
    }
    buf += text[i];
    i++;
  }
  if (buf) out.push(buf);
  return out;
}

/** 手動ルビ「漢字《よみ》」を優先し、残りの部分には自動ルビを付ける */
export function toPieces(text: string): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  for (const m of text.matchAll(MANUAL_RUBY)) {
    out.push(...autoRuby(text.slice(last, m.index)));
    out.push({ base: m[1], rt: m[2] });
    last = m.index! + m[0].length;
  }
  out.push(...autoRuby(text.slice(last)));
  return out;
}

const stripManual = (text: string) => text.replace(MANUAL_RUBY, '$1');

/** 日本語の文章を表示する。設定でふりがながオンなら漢字に読みを付ける */
export function Ruby({ text, children }: { text?: string; children?: ReactNode }) {
  const { furigana } = useSettings();
  const s = text ?? (typeof children === 'string' ? children : '');
  if (!furigana || !KANJI.test(s)) return <>{stripManual(s)}</>;
  return (
    <>
      {toPieces(s).map((p, i) =>
        typeof p === 'string' ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <ruby key={i}>
            {p.base}
            <rt>{p.rt}</rt>
          </ruby>
        ),
      )}
    </>
  );
}
