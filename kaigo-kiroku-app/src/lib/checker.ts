import type { CategoryDef, Finding, RecordEntry, Scenario, Soap } from '../types';

/** 推測・感想を表す語。O（客観的情報）に入っていたら注意 */
const SPECULATION = [
  'と思う', 'と思います', 'と思われる', 'だろう', 'でしょう', 'かもしれない', 'かもしれません',
  'はずだ', 'はずです', 'みたい', 'ようだ', 'ようです', 'そうだ', 'そうです', 'らしい',
  'せいだ', 'せいで', 'のだと思', 'に違いない', 'たぶん', 'おそらく', 'きっと',
];

/** 感情・感想を表す語。記録に書くのは利用者の言葉・行動であって職員の感情ではない */
const FEELINGS = ['かわいそう', '心配だ', '心配です', '困った', '困る', 'うれしかった', '嬉しかった', '悲しかった', '腹が立', 'イライラ', '大変だった'];

/** あいまいな量・程度の表現。数字に置き換える */
const VAGUE = [
  { word: 'たくさん', hint: '「主食8割」「300ml」のように数字で' },
  { word: 'いっぱい', hint: '量は数字で' },
  { word: '少し', hint: '「約50ml」「直径1cm」「2回」のように数字で' },
  { word: 'ちょっと', hint: '数字や具体的な様子で' },
  { word: 'あまり', hint: '「主食3割」のように数字で' },
  { word: 'ほとんど', hint: '「9割」「全量」のように数字で' },
  { word: 'かなり', hint: '数字で' },
  { word: 'けっこう', hint: '数字で' },
  { word: '結構', hint: '数字で' },
  { word: 'しばらく', hint: '「約20分」のように時間で' },
  { word: 'いつもより', hint: '「普段は主食10割、本日は5割」のように比べる数字を書く' },
  { word: '元気', hint: '「食事全量摂取」「笑顔で会話」など見たことで' },
  { word: '普通', hint: '何が普通なのか、見たことで' },
  { word: '良好', hint: '何がどう良いのか、数字・様子で' },
  { word: '不良', hint: '何がどう悪いのか、数字・様子で' },
];

/** 利用者の尊厳を傷つける・ラベル貼りの表現 */
const LABELS = [
  { word: '徘徊', hint: '「廊下を行ったり来たりして歩いていた」のように行動をそのまま' },
  { word: 'わがまま', hint: '本人の言葉と行動をそのまま書く' },
  { word: '暴言', hint: '「大きな声で『出ていけ』と言った」のように言葉をそのまま' },
  { word: '暴力', hint: '「職員の腕を右手でつかんだ」のように行動をそのまま' },
  { word: '拒否的', hint: '「『入らない』と言い、立ち上がらなかった」のように' },
  { word: '問題行動', hint: '具体的な行動を書く' },
  { word: '不穏', hint: '何をしていたか、何と言ったかを書く' },
  { word: 'ボケ', hint: '使わない。見た事実を書く' },
  { word: '痴呆', hint: '現在は「認知症」。症状は見た事実で' },
  { word: '面倒', hint: '職員の感情は書かない' },
  { word: 'うるさい', hint: '「10分間、大きな声で○○と言い続けた」のように' },
  { word: 'しつこい', hint: '「5回同じ質問をした」のように回数で' },
  { word: 'ぐずる', hint: '本人の言葉・行動で' },
  { word: 'さぼ', hint: '本人の言葉・行動で' },
  { word: '悪い', hint: '評価ではなく事実を' },
];

/** 時刻の表記（12:30 / 12時30分 / ７：３０） */
const TIME_RE = /(\d{1,2}|[０-９]{1,2})\s*(:|：|時)\s*(\d{1,2}|[０-９]{1,2})\s*分?/;

/** 「」内は本人・他者の言葉そのものなので、推測・感情のチェック対象から外す */
const stripQuotes = (s: string) => s.replace(/「[^」]*」|『[^』]*』/g, '「」');

const toHalf = (s: string) => s.replace(/[０-９．：]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

const includesAny = (text: string, words: string[]) => {
  const t = toHalf(text);
  return words.find((w) => t.includes(w));
};

/** 長い語から順に照合し、一度当たった部分は消す（「のだと思う」で「と思う」まで二重に指摘しない） */
const findAll = (text: string, words: string[]) => {
  let t = toHalf(text);
  const hits: string[] = [];
  for (const w of [...words].sort((a, b) => b.length - a.length)) {
    if (t.includes(w)) {
      hits.push(w);
      t = t.split(w).join('■'.repeat(w.length));
    }
  }
  return hits;
};

export interface CheckResult {
  findings: Finding[];
  /** 0-100 */
  score: number;
  /** 要点ごとの達成状況（場面モードのみ） */
  keyPointHits: { label: string; hit: boolean; part?: string }[];
  /** 入力項目ごとの正誤（場面モードのみ） */
  fieldHits: { id: string; label: string; ok: boolean; expected: string; actual: string }[];
}

/**
 * SOAP の文章を規則でチェックする。
 * - O に推測・感想・あいまい語・ラベルがないか
 * - 本人の言葉が S に「」で入っているか
 * - 時刻・数字があるか
 * - P が行動（〜する）になっているか
 */
export function checkSoap(soap: Soap, category?: CategoryDef): Finding[] {
  const f: Finding[] = [];
  const all = `${soap.s}\n${soap.o}\n${soap.a}\n${soap.p}`;

  // --- O: 事実と推測の区別 ---
  for (const w of findAll(stripQuotes(soap.o), SPECULATION)) {
    f.push({ severity: 'error', part: 'O', match: w, message: `「${w}」は推測です。O（客観的情報）には見たこと・聞いたこと・測った数字だけを書き、推測は A に「〜の可能性がある」と書きましょう。` });
  }
  for (const w of findAll(stripQuotes(soap.o), FEELINGS)) {
    f.push({ severity: 'error', part: 'O', match: w, message: `「${w}」は職員の感情です。記録には利用者の様子を書き、職員の気持ちは書きません。` });
  }
  for (const w of findAll(soap.s, SPECULATION)) {
    f.push({ severity: 'warn', part: 'S', match: w, message: `S は本人の言葉をそのまま書く欄です。「${w}」のような職員の推測は A へ。` });
  }
  for (const { word, hint } of VAGUE) {
    if (toHalf(soap.o).includes(word)) {
      f.push({ severity: 'warn', part: 'O', match: word, message: `「${word}」はあいまいな表現です。`, suggestion: hint });
    }
  }
  for (const { word, hint } of LABELS) {
    const where = (['s', 'o', 'a', 'p'] as const).find((k) => toHalf(soap[k]).includes(word));
    if (where) {
      f.push({ severity: 'error', part: where.toUpperCase(), match: word, message: `「${word}」は利用者の尊厳を傷つける・ラベルを貼る表現です。`, suggestion: hint });
    }
  }

  // --- S: 本人の言葉 ---
  const sTrim = soap.s.trim();
  if (!sTrim) {
    f.push({ severity: 'info', part: 'S', message: '本人の言葉がない場合は「（発語なし）」「（特になし）」と書くと、空欄との区別ができます。' });
  } else if (!/[「『"“]/.test(sTrim) && !sTrim.startsWith('（')) {
    f.push({ severity: 'warn', part: 'S', message: '本人の言葉は「」で囲んで、言ったとおりに書きましょう（例：「体がだるいわ」）。' });
  }
  if (/[「『]/.test(soap.o) === false && /と言った|と話した|と訴え/.test(soap.o)) {
    f.push({ severity: 'info', part: 'O', message: '本人の言葉を O に書くときも「」で囲みましょう。' });
  }

  // --- O: 5W1H の要素 ---
  if (!TIME_RE.test(toHalf(soap.o))) {
    f.push({ severity: 'warn', part: 'O', message: 'いつ（時刻）が書かれていません。「7:30」「12時40分」のように書きましょう。' });
  }
  if (!/\d/.test(toHalf(soap.o))) {
    f.push({ severity: 'warn', part: 'O', message: '数字がありません。量・回数・時間・測定値など、数字で書けるものは数字で。' });
  }
  if (soap.o.trim().length < 20) {
    f.push({ severity: 'warn', part: 'O', message: 'O が短すぎます。いつ・どこで・誰が・何を・どのように、を順番に書きましょう。' });
  }
  if (category?.id === 'incident' && !includesAny(all, ['報告'])) {
    f.push({ severity: 'warn', part: 'O', message: '事故・ヒヤリハットは「誰に報告したか」を必ず書きます。' });
  }
  if (category && ['vital', 'bath', 'incident', 'medication'].includes(category.id) && !includesAny(all, ['看護師', 'リーダー', '医師', '報告'])) {
    f.push({ severity: 'info', part: 'O', message: 'いつもと違うことがあったときは、誰に報告したかを書きましょう。' });
  }

  // --- A ---
  if (!soap.a.trim()) {
    f.push({ severity: 'warn', part: 'A', message: 'A（アセスメント）が空です。O の事実から考えられることを「〜の可能性がある」「〜と考えられる」と書きましょう。' });
  } else if (!includesAny(soap.a, ['可能性', '考えられ', '思われ', 'おそれ', '危険', 'リスク', '必要', 'ない', 'なし', '問題', '疑'])) {
    f.push({ severity: 'info', part: 'A', message: 'A は職員の専門的な判断です。「〜の可能性がある」「〜と考えられる」のように、O の事実をもとにした判断として書きましょう。' });
  }

  // --- P ---
  if (!soap.p.trim()) {
    f.push({ severity: 'warn', part: 'P', message: 'P（計画）が空です。次に何をするか、「〜する」「〜を観察する」「〜に報告する」と書きましょう。' });
  } else if (!includesAny(soap.p, ['する', 'します', '行う', '観察', '報告', '相談', '確認', '続け', '継続', 'ください', '徹底', '共有', 'お願い'])) {
    f.push({ severity: 'info', part: 'P', message: 'P は行動で書きます。「〜する」「〜を観察する」「〜に報告する」のように。' });
  }

  if (f.filter((x) => x.severity === 'error').length === 0 && f.filter((x) => x.severity === 'warn').length === 0) {
    f.unshift({ severity: 'good', part: '全体', message: '事実と推測が分けて書けています。数字・時刻も入っています。' });
  }
  return f;
}

const fmtExpected = (v: string | number) => String(v);

const numEq = (a: string, b: string | number, tol = 0) => {
  const x = parseFloat(toHalf(a));
  const y = typeof b === 'number' ? b : parseFloat(toHalf(b));
  if (Number.isNaN(x) || Number.isNaN(y)) return toHalf(a).trim() === String(b).trim();
  return Math.abs(x - y) <= tol + 1e-9;
};

/** 場面モード：入力項目・要点・SOAP の質を合わせて採点する */
export function evaluate(entry: RecordEntry, scenario: Scenario | undefined, category: CategoryDef): CheckResult {
  const findings = checkSoap(entry.soap, category);

  const fieldHits: CheckResult['fieldHits'] = [];
  const keyPointHits: CheckResult['keyPointHits'] = [];

  if (scenario) {
    for (const [id, exp] of Object.entries(scenario.expected)) {
      const def = category.fields.find((x) => x.id === id);
      const actual = entry.fields[id] ?? '';
      const ok =
        def?.type === 'number'
          ? numEq(actual, exp.value, exp.tolerance ?? 0)
          : toHalf(actual).trim() === toHalf(String(exp.value)).trim();
      fieldHits.push({ id, label: def?.label ?? id, ok, expected: fmtExpected(exp.value) + (def?.unit ?? ''), actual });
    }
    const all = `${entry.soap.s}\n${entry.soap.o}\n${entry.soap.a}\n${entry.soap.p}`;
    for (const kp of scenario.keyPoints) {
      keyPointHits.push({ label: kp.label, hit: !!includesAny(all, kp.any), part: kp.part });
    }
  }

  // 採点：項目 30 / 要点 40 / 文章の質 30
  const fieldScore = fieldHits.length ? (fieldHits.filter((x) => x.ok).length / fieldHits.length) * 30 : 30;
  const kpScore = keyPointHits.length ? (keyPointHits.filter((x) => x.hit).length / keyPointHits.length) * 40 : 40;
  const errors = findings.filter((x) => x.severity === 'error').length;
  const warns = findings.filter((x) => x.severity === 'warn').length;
  const qualityScore = Math.max(0, 30 - errors * 8 - warns * 4);

  const score = Math.round(fieldScore + kpScore + qualityScore);
  return { findings, score, keyPointHits, fieldHits };
}
