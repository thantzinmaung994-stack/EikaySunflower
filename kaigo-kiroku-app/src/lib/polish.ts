/**
 * 記録を整える（現場の下書きを、記録らしい文に直す）。
 * - すべて端末の中のルールで処理する。文章を外部に送らない・費用もかからない。
 * - 事実は作らない：わからないところは［　］の空欄にして、質問で聞く。
 * - 「」の中は本人の言葉なので、変えない。
 */

export type ChangeKind = 'keigo' | 'particle' | 'time' | 'vague' | 'quote';

export interface PolishChange {
  kind: ChangeKind;
  from: string;
  to: string;
  reason: string;
}

export interface PolishNote {
  kind: 'speculation' | 'feeling' | 'label' | 'tense' | 'name';
  match?: string;
  message: string;
}

export interface PolishResult {
  /** 書き直し案（［　］は書き足すところ） */
  draft: string;
  changes: PolishChange[];
  /** 自動では直せないので、自分で書き直すところ */
  notes: PolishNote[];
  /** 書き足すとよいこと */
  questions: string[];
}

export interface PolishOptions {
  /** 敬語（参加された・召し上がった など）を、ふつうの言い方に直す */
  plain: boolean;
}

const toHalf = (s: string) => s.replace(/[０-９．：]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
const TIME_RE = /(\d{1,2})\s*(:|時)\s*(\d{1,2})?/;

// ---------------- 敬語 → ふつうの言い方 ----------------

/** 動詞の語尾（され・られ のあと） */
const ENDS = '(る|た|て|、|ます|ました|ている|ていた|ていました)';

/** 決まった敬語 */
const SPECIAL: [RegExp, string][] = [
  [/召し上がっ(た|て)/g, '食べ$1'],
  [/召し上がる/g, '食べる'],
  [/召し上がり(ます|ました|、)/g, '食べ$1'],
  [/おっしゃっ(た|て)/g, '言っ$1'],
  [/おっしゃる/g, '言う'],
  [/おっしゃい(ます|ました)/g, '言い$1'],
  [/いらっしゃっ(た|て)/g, 'い$1'],
  [/いらっしゃる/g, 'いる'],
  [/いらっしゃい(ます|ました)/g, 'い$1'],
  [/お休みになられ(た)/g, '休んだ'],
  [/お休みになっ(た)/g, '休んだ'],
  [/お休みになって/g, '休んで'],
  [/お休みになる/g, '休む'],
  [/来られ(た|て|る)/g, '来$1'],
  [/なられ(た)/g, 'なった'],
  [/なられて/g, 'なって'],
  [/なられる/g, 'なる'],
];

/**
 * 「〜された」には「参加された（敬語）」と「注意された（受け身）」がある。
 * 受け身になりやすい語と、「職員に〜された」のように相手がいる文は直さない。
 */
const PASSIVE_SAHEN = new Set(['確認', '観察', '発見', '指示', '注意', '報告', '依頼', '説明', '指摘', '介助', '誘導', '支援', '対応', '処置', '投与', '実施', '記録', '測定', '判断', '診察', '入院', '検討']);
/** 五段・一段動詞は、利用者の動作によく使う語だけを直す（「書かれた」「生まれた」などの受け身・別の意味を誤って直さないため） */
const GODAN_OK = new Set(['動かす', '話す', '歩く', '飲む', '帰る', '座る', '休む', '立つ', '戻る', '入る', '眠る', '読む', '選ぶ', '遊ぶ', '歌う', '使う', '待つ', '過ごす', '移る', '乗る', '洗う', '拭く', '磨く', '喜ぶ', '楽しむ', '持つ', '履く', '脱ぐ', '握る', '通う', '向かう', '作る', '走る', '頑張る', '話し合う', '済ます', '渡る', '曲がる', '上がる', '下がる', '回す', '伸ばす', '曲げる', '残す', '飲み込む', '休む']);
/** ひらがなだけの動詞（漢字の規則では見つからないもの） */
const KANA_GODAN = ['ふらつく', 'つまずく', 'うなずく', 'しゃべる', 'くつろぐ', 'ぐずる', 'もどる', 'すわる', 'ねむる', 'やすむ'];

const ICHIDAN_OK = new Set(['食べる', '起きる', '着る', '降りる', '浴びる', '出かける', '着替える', '続ける', '終える', '答える', '覚える', '決める', '調べる', '受ける', '始める', '出る', '上げる', '下げる', '曲げる', '伸びる', '投げる', '数える', '並べる']);
const AGENT_BEFORE = /(職員|看護師|介護士|医師|家族|利用者|スタッフ|さん|様|ちゃん|くん|君|者|人)に[^。、]{0,8}$/;

/** 五段動詞：未然形の「あ」段 → 終止形・連用形・た形 */
const GODAN: Record<string, { u: string; i: string; ta: string; te: string }> = {
  さ: { u: 'す', i: 'し', ta: 'した', te: 'して' },
  か: { u: 'く', i: 'き', ta: 'いた', te: 'いて' },
  が: { u: 'ぐ', i: 'ぎ', ta: 'いだ', te: 'いで' },
  ま: { u: 'む', i: 'み', ta: 'んだ', te: 'んで' },
  ば: { u: 'ぶ', i: 'び', ta: 'んだ', te: 'んで' },
  わ: { u: 'う', i: 'い', ta: 'った', te: 'って' },
  た: { u: 'つ', i: 'ち', ta: 'った', te: 'って' },
  ら: { u: 'る', i: 'り', ta: 'った', te: 'って' },
};

function godanTail(a: string, end: string): string {
  const g = GODAN[a];
  switch (end) {
    case 'る': return g.u;
    case 'た': return g.ta;
    case 'て': return g.te;
    case '、': return `${g.i}、`;
    case 'ている': return `${g.te}いる`;
    case 'ていた': return `${g.te}いた`;
    case 'ていました': return `${g.te}いました`;
    default: return g.i + end; // ます・ました
  }
}

function sahenTail(end: string): string {
  switch (end) {
    case 'る': return 'する';
    case '、': return 'し、';
    case 'ている': return 'している';
    case 'ていた': return 'していた';
    case 'ていました': return 'していました';
    default: return `し${end}`; // た・て・ます・ました
  }
}

function ichidanTail(end: string): string {
  switch (end) {
    case '、': return '、';
    default: return end; // る・た・て・ます・ました・ている…
  }
}

type Rule = { re: RegExp; fn: (m: RegExpExecArray, before: string) => string | null; kind: ChangeKind; reason: string };

const KEIGO_REASON = '記録は敬語を使わず、ふつうの言い方で書くのが基本です。';

const KEIGO_RULES: Rule[] = [
  ...SPECIAL.map(([re, to]): Rule => ({ re, kind: 'keigo', reason: KEIGO_REASON, fn: (m) => m[0].replace(new RegExp(re.source), to) })),
  {
    // 参加された → 参加した（漢字・カタカナの語＋され）
    re: new RegExp(`([一-龥ァ-ヶー]{2,})され${ENDS}`, 'g'),
    kind: 'keigo',
    reason: KEIGO_REASON,
    fn: (m, before) => {
      const noun = m[1];
      if ([...PASSIVE_SAHEN].some((w) => noun.endsWith(w)) || AGENT_BEFORE.test(before)) return null;
      return noun + sahenTail(m[2]);
    },
  },
  {
    // 体操をされた → 体操をした、うがいをされ、→ うがいをし、
    re: new RegExp(`をされ${ENDS}`, 'g'),
    kind: 'keigo',
    reason: KEIGO_REASON,
    fn: (m, before) => (AGENT_BEFORE.test(before) ? null : `を${sahenTail(m[1])}`),
  },
  {
    // テレビを見られていた → テレビを見ていた（「発赤が見られる」は直さない）
    re: new RegExp(`を見られ${ENDS}`, 'g'),
    kind: 'keigo',
    reason: KEIGO_REASON,
    fn: (m, before) => (AGENT_BEFORE.test(before) ? null : `を見${ichidanTail(m[1])}`),
  },
  {
    // 〜と言われた → 〜と言った（「職員に〜と言われた」は受け身なので直さない）
    re: new RegExp(`と言われ${ENDS}`, 'g'),
    kind: 'keigo',
    reason: KEIGO_REASON,
    fn: (m, before) => (AGENT_BEFORE.test(before) ? null : `と言${godanTail('わ', m[1])}`),
  },
  ...KANA_GODAN.map((v): Rule => {
    const stem = v.slice(0, -1);
    const a = Object.keys(GODAN).find((k) => GODAN[k].u === v.slice(-1))!;
    return {
      re: new RegExp(`${stem}${a}れ${ENDS}`, 'g'),
      kind: 'keigo',
      reason: KEIGO_REASON,
      fn: (m, before) => (AGENT_BEFORE.test(before) ? null : stem + godanTail(a, m[1])),
    };
  }),
  {
    // 動かされる → 動かす、話された → 話した、帰られた → 帰った、行かれた → 行った
    re: new RegExp(`(?<![一-龥ァ-ヶー])([一-龥]{1,2})([ぁ-ん]?)([さかがまばわたら])れ${ENDS}`, 'g'),
    kind: 'keigo',
    reason: KEIGO_REASON,
    fn: (m, before) => {
      const [, k, oku, a, end] = m;
      if (AGENT_BEFORE.test(before)) return null;
      if (k === '行' && !oku && a === 'か') return '行' + godanTail('ら', end);
      if (!GODAN_OK.has(k + oku + GODAN[a].u)) return null;
      return k + oku + godanTail(a, end);
    },
  },
  {
    // 食べられた → 食べた、起きられる → 起きる（一段動詞）
    re: new RegExp(`(?<![一-龥ァ-ヶー])([一-龥]{1,2})([ぁ-ん]*[いきぎしじちにひびみりえけげせぜてでねへべめれ])られ${ENDS}`, 'g'),
    kind: 'keigo',
    reason: KEIGO_REASON,
    fn: (m, before) => {
      const [, k, oku, end] = m;
      if (AGENT_BEFORE.test(before) || !ICHIDAN_OK.has(`${k + oku}る`)) return null;
      return k + oku + ichidanTail(end);
    },
  },
];

// ---------------- 助詞・時刻・あいまいな言葉 ----------------

const PARTICLE_RULES: Rule[] = [
  { re: /を(参加|出席)/g, kind: 'particle', reason: '「参加」「出席」は「〜に参加する」と書きます。', fn: (m) => `に${m[1]}` },
];

const TIME_WORDS = ['午前中', '午後', '夕方', '夜間', '早朝', '日中', '朝方', '夜中', '昼頃', '昼ごろ', '夕食後', '朝食後', '昼食後'];

const VAGUE_RULES: { re: RegExp; to: string; reason: string; question: string }[] = [
  { re: /(良く|よく)(?=[動眠寝食歩話笑飲]|体を|手を|足を)/g, to: '［どのくらい：例 両腕を肩の高さまで］', reason: '「よく」は職員の感じ方です。何を、どのくらいしたかを書きます。', question: '「よく」とは、具体的にどこを、どのくらい（回数・時間・量）でしたか？' },
  { re: /元気よく|元気に/g, to: '［どんな様子で：例 笑顔で、大きな声で］', reason: '「元気」は職員の感じ方です。見た様子を書きます。', question: '「元気」とは、どんな様子でしたか？（表情・声・動き）' },
  { re: /(楽しそう|嬉しそう|うれしそう|つらそう|辛そう|苦しそう|痛そう|眠そう|不機嫌そう|満足そう|不安そう|寂しそう|さみしそう)(に|な|だ|で)?/g, to: '［見た様子：例 笑顔で、眉間にしわを寄せて］', reason: '「〜そう」は推測です。表情・言葉・動きなど、見たことを書きます。', question: 'そう見えたのは、どんな表情・言葉・動きからですか？' },
  { re: /たくさん|いっぱい/g, to: '［量：例 主食8割、300ml］', reason: '量は数字で書きます。', question: '量はどのくらいでしたか？（割合・ml・回数）' },
  { re: /少し|ちょっと/g, to: '［量：例 約50ml、2回、直径1cm］', reason: '「少し」はあいまいです。数字で書きます。', question: '「少し」とは、数字でどのくらいですか？' },
  { re: /しばらく/g, to: '［時間：例 約20分］', reason: '時間は数字で書きます。', question: 'どのくらいの時間でしたか？' },
  { re: /半分(ほど|くらい|ぐらい)?/g, to: '［割合：例 主食5割］', reason: '割合は「5割」のように数字で書きます。', question: '何割くらいでしたか？' },
  { re: /ほとんど/g, to: '［量：例 9割、全量］', reason: '割合は数字で書きます。', question: '何割くらいでしたか？' },
];

const SPECULATION = ['と思う', 'と思います', 'と思われる', 'だろう', 'でしょう', 'かもしれない', 'みたい', 'ようだ', 'ようです', 'らしい', 'たぶん', 'おそらく', 'きっと', 'に違いない'];
const FEELINGS = ['しょうがない', '仕方ない', 'かわいそう', '心配だ', '困った', 'うれしかった', '嬉しかった', '悲しかった', 'イライラ', '大変だった', '面倒'];
const LABELS: { word: string; hint: string }[] = [
  { word: '徘徊', hint: '「廊下を行ったり来たりして歩いていた」のように行動をそのまま' },
  { word: '暴言', hint: '「大きな声で『出ていけ』と言った」のように言葉をそのまま' },
  { word: '暴力', hint: '「職員の腕を右手でつかんだ」のように行動をそのまま' },
  { word: '不穏', hint: '何をしていたか、何と言ったかを書く' },
  { word: 'わがまま', hint: '本人の言葉と行動をそのまま書く' },
  { word: '拒否的', hint: '「『入らない』と言い、立ち上がらなかった」のように' },
  { word: '問題行動', hint: '具体的な行動を書く' },
  { word: 'お漏らし', hint: '「失禁」と書き、量と時刻を書く' },
  { word: 'おもらし', hint: '「失禁」と書き、量と時刻を書く' },
  { word: 'ボケ', hint: '使わない。見た事実を書く' },
  { word: '年だから', hint: '年齢のせいにしない。いつ・何が起きたかを書く' },
  { word: 'だらしな', hint: '職員の評価は書かない。見た事実を書く' },
];

const PLACES = ['居室', '食堂', 'デイルーム', 'ホール', 'リビング', '浴室', '浴槽', '脱衣', 'トイレ', '廊下', 'ベッド', '訓練室', 'リハビリ室', '玄関', '洗面', '談話室', '屋外', '中庭', '庭', 'ベランダ', '車いす', '車椅子', '自宅', '送迎', 'エレベーター', '階段', 'ナースステーション', '詰所', '機械浴', '個浴'];
const WHO = /さん|様|氏|本人|利用者|入居者|入所者/;
const INCIDENT = ['転倒', '転落', 'ずり落ち', '尻もち', 'けが', '怪我', '出血', '発熱', '嘔吐', '誤嚥', 'むせ', '発赤', 'あざ', '内出血', '意識', '痛み', '腫れ', '誤薬', '行方'];

// ---------------- 本体 ----------------

/** 「」と『』の中を守るため、文章を「外」と「中」に分ける */
function splitQuotes(text: string): { s: string; quote: boolean }[] {
  const out: { s: string; quote: boolean }[] = [];
  const re = /「[^」]*」|『[^』]*』/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ s: text.slice(last, m.index), quote: false });
    out.push({ s: m[0], quote: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ s: text.slice(last), quote: false });
  return out;
}

/** prefix は、この部分より前の文（「Bさんに『…』と言われた」の「Bさんに」を見るため） */
function applyRule(seg: string, rule: Rule, changes: PolishChange[], prefix: string): string {
  let out = '';
  let last = 0;
  const re = new RegExp(rule.re.source, 'g');
  for (let m = re.exec(seg); m; m = re.exec(seg)) {
    const before = out + seg.slice(last, m.index);
    const to = rule.fn(m, prefix + before);
    if (to === null || to === m[0]) continue;
    out = before + to;
    last = m.index + m[0].length;
    changes.push({ kind: rule.kind, from: m[0], to, reason: rule.reason });
  }
  return out + seg.slice(last);
}

export function polish(input: string, opts: PolishOptions = { plain: true }): PolishResult {
  const changes: PolishChange[] = [];
  const notes: PolishNote[] = [];
  const questions: string[] = [];
  const ask = (q: string) => {
    if (!questions.includes(q)) questions.push(q);
  };
  const text = input.trim();
  if (!text) return { draft: '', changes, notes, questions };

  // 「〜と言った」の前にある本人の言葉を「」で囲む（「」の中は変えない）
  let quoted = '';
  let rest = text;
  // 「家族と話した」の「と」は「〜といっしょに」なので、言・訴・おっしゃ だけを見る
  const SAID = /([^、。「」『』はが]{2,30})と(言|訴|おっしゃ)/;
  const TO_WHOM = /^(.*(職員|看護師|介護士|医師|家族|利用者|スタッフ|さん|様)に)(.+)$/;
  for (let m = SAID.exec(rest); m; m = SAID.exec(rest)) {
    // 「職員に帰りたいと言った」の「職員に」は言葉ではないので、「」の外に出す
    const split = TO_WHOM.exec(m[1]);
    const lead = split ? split[1] : '';
    const words = split ? split[3] : m[1];
    // すでに「」の中なら何もしない
    const head = rest.slice(0, m.index);
    if ((head.match(/「/g)?.length ?? 0) > (head.match(/」/g)?.length ?? 0)) {
      quoted += rest.slice(0, m.index + m[0].length);
      rest = rest.slice(m.index + m[0].length);
      continue;
    }
    const to = `「${words}」と${m[2]}`;
    changes.push({ kind: 'quote', from: `${words}と${m[2]}`, to, reason: '本人の言葉は「」で囲み、言ったとおりに書きます。' });
    quoted += head + lead + to;
    rest = rest.slice(m.index + m[0].length);
  }
  const src = quoted + rest;

  const hasTime = TIME_RE.test(toHalf(src));
  let timeDone = false;

  let prefix = '';
  const parts = splitQuotes(src).map(({ s, quote }) => {
    const pre = prefix;
    prefix += s;
    if (quote) return s;
    let seg = s;
    if (opts.plain) for (const r of KEIGO_RULES) seg = applyRule(seg, r, changes, pre);
    for (const r of PARTICLE_RULES) seg = applyRule(seg, r, changes, pre);
    // 時刻：数字の時刻がないときだけ、最初のあいまいな時間の言葉を空欄にする
    if (!hasTime && !timeDone) {
      const w = TIME_WORDS.find((x) => seg.includes(x));
      if (w) {
        const to = `${w}（［時刻：例 10:00〜10:30］）`;
        seg = seg.replace(w, to);
        timeDone = true;
        changes.push({ kind: 'time', from: w, to, reason: `「${w}」だけでは時間がはっきりしません。時刻も書きます。` });
      }
    }
    for (const v of VAGUE_RULES) {
      seg = seg.replace(new RegExp(v.re.source, 'g'), (m) => {
        changes.push({ kind: 'vague', from: m, to: v.to, reason: v.reason });
        ask(v.question);
        return v.to;
      });
    }
    return seg;
  });

  let draft = parts.join('');
  if (!/[。．.！!？?」』）)]$/.test(draft)) draft += '。';

  // --- 自分で直すところ（「」の外だけを見る） ---
  const outside = splitQuotes(src).filter((p) => !p.quote).map((p) => p.s).join(' ');
  const found = new Set<string>();
  for (const w of [...SPECULATION].sort((a, b) => b.length - a.length)) {
    if (outside.includes(w) && ![...found].some((f) => f.includes(w))) {
      found.add(w);
      notes.push({ kind: 'speculation', match: w, message: `「${w}」は推測です。見たこと・聞いたこと・測ったことに書き直し、推測は「〜の可能性がある」として分けて書きます。` });
    }
  }
  for (const w of FEELINGS) {
    if (outside.includes(w)) notes.push({ kind: 'feeling', match: w, message: `「${w}」は職員の気持ちです。記録には書かず、利用者の様子を書きます。` });
  }
  for (const { word, hint } of LABELS) {
    if (outside.includes(word)) notes.push({ kind: 'label', match: word, message: `「${word}」は利用者の尊厳を傷つける言い方です。${hint}。` });
  }
  if (/(る|う|く|す|む|ぶ|ぐ|つ)[。]?$/.test(draft.replace(/。$/, '')) && !/(ている|ていく|ている。)$/.test(draft)) {
    notes.push({ kind: 'tense', message: 'すでにあったことは「〜した」「〜していた」のように、過去の形で書くのが基本です。' });
  }
  if (/[一-龥]{1,3}(さん|様)/.test(text) && !/^[A-ZＡ-Ｚ]/.test(text) && !/[A-ZＡ-Ｚ](さん|様)/.test(text)) {
    notes.push({ kind: 'name', message: 'このアプリでは、実在の人の名前は書かず「Aさん」のように書きましょう。' });
  }

  // --- 書き足すとよいこと（5W1H） ---
  if (!WHO.test(text)) ask('誰のことですか？（例：Aさん）');
  if (!hasTime) ask('何時何分でしたか？（続いたことは「10:00〜10:30」のように）');
  if (!PLACES.some((p) => text.includes(p))) ask('どこでしたか？（例：居室、食堂、デイルーム、浴室、トイレ）');
  if (!/[「『]/.test(text)) ask('本人の言葉はありましたか？あれば「」で、言ったとおりに書きます。');
  if (!/\d|[０-９]/.test(text.replace(/[A-ZＡ-Ｚ]さん/g, '')) && !changes.some((c) => c.kind === 'vague')) ask('量・回数・時間・測った値など、数字で書けることはありますか？');
  if (INCIDENT.some((w) => text.includes(w)) && !/報告/.test(text)) ask('誰に、何時に報告しましたか？（例：10:40 看護師に報告）');

  return { draft, changes, notes, questions };
}
