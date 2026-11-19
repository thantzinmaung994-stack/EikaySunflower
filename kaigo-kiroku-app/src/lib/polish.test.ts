import { describe, expect, it } from 'vitest';
import { polish } from './polish';

const draft = (t: string, plain = true) => polish(t, { plain }).draft;

describe('記録を整える', () => {
  it('お手本の文：時刻・助詞・敬語・あいまいな言葉を直し、事実は空欄にする', () => {
    const r = polish('Aさんは午前中リハビリ体操を参加され、体を良く動かされる');
    expect(r.draft).toBe('Aさんは午前中（［時刻：例 10:00〜10:30］）リハビリ体操に参加し、体を［どのくらい：例 両腕を肩の高さまで］動かす。');
    expect(r.changes.map((c) => c.kind).sort()).toEqual(['keigo', 'keigo', 'particle', 'time', 'vague']);
    expect(r.questions.some((q) => q.includes('何時'))).toBe(true);
    expect(r.questions.some((q) => q.includes('どこ'))).toBe(true);
    expect(r.questions.some((q) => q.includes('本人の言葉'))).toBe(true);
    expect(r.notes.some((n) => n.kind === 'tense')).toBe(true);
  });

  it('敬語をふつうの言い方に直す', () => {
    expect(draft('10:00 Aさんは昼食を召し上がった')).toBe('10:00 Aさんは昼食を食べた。');
    expect(draft('Aさんは「おいしい」とおっしゃった')).toBe('Aさんは「おいしい」と言った。');
    expect(draft('14:00 Aさんは散歩に参加された')).toBe('14:00 Aさんは散歩に参加した。');
    expect(draft('14:00 Aさんは居室に帰られた')).toBe('14:00 Aさんは居室に帰った。');
    expect(draft('14:00 Aさんは廊下を歩かれていた')).toBe('14:00 Aさんは廊下を歩いていた。');
    expect(draft('12:00 Aさんは主食を食べられました')).toBe('12:00 Aさんは主食を食べました。');
    expect(draft('15:00 Aさんは家族と話されていました')).toBe('15:00 Aさんは家族と話していました。');
    expect(draft('21:00 Aさんはお休みになった')).toBe('21:00 Aさんは休んだ。');
    expect(draft('10:00 Aさんは食堂に行かれた')).toBe('10:00 Aさんは食堂に行った。');
    expect(draft('7:30 Aさんは朝食を召し上がり、お茶を飲まれた')).toBe('7:30 Aさんは朝食を食べ、お茶を飲んだ。');
    expect(draft('10:00 Aさんはうがいをされた')).toBe('10:00 Aさんはうがいをした。');
    expect(draft('10:00 Aさんは居室でテレビを見られていた')).toBe('10:00 Aさんは居室でテレビを見ていた。');
    expect(draft('10:00 Aさんは立たれ、ふらつかれた')).toBe('10:00 Aさんは立ち、ふらついた。');
  });

  it('受け身・別の意味の語は直さない', () => {
    expect(draft('10:00 仙骨部に発赤が確認された')).toBe('10:00 仙骨部に発赤が確認された。');
    expect(draft('10:00 Aさんは職員に注意された')).toBe('10:00 Aさんは職員に注意された。');
    expect(draft('10:00 AさんはBさんに押された')).toBe('10:00 AさんはBさんに押された。');
    expect(draft('10:00 右腕に内出血が見られる')).toBe('10:00 右腕に内出血が見られる。');
    expect(draft('10:00 ノートに名前が書かれていた')).toBe('10:00 ノートに名前が書かれていた。');
    expect(draft('10:00 発熱が考えられる')).toBe('10:00 発熱が考えられる。');
  });

  it('敬語を直さない設定では、敬語はそのまま', () => {
    expect(draft('14:00 Aさんは散歩に参加された', false)).toBe('14:00 Aさんは散歩に参加された。');
  });

  it('「」の中（本人の言葉）は変えない', () => {
    const r = polish('10:00 Aさんは「少し痛い。参加されたくない」と言った');
    expect(r.draft).toBe('10:00 Aさんは「少し痛い。参加されたくない」と言った。');
    expect(r.changes).toEqual([]);
  });

  it('「〜と言った」の前の本人の言葉を「」で囲み、中は変えない', () => {
    const r = polish('10:00 Aさんはリハビリを受けられ、少し疲れたと言われた');
    expect(r.draft).toBe('10:00 Aさんはリハビリを受け、「少し疲れた」と言った。');
    expect(r.changes.some((c) => c.kind === 'quote')).toBe(true);
    expect(draft('10:00 Aさんは職員に帰りたいと言われた')).toBe('10:00 Aさんは職員に「帰りたい」と言われた。');
    expect(draft('10:00 AさんはBさんにうるさいと言われた')).toBe('10:00 AさんはBさんに「うるさい」と言われた。');
    expect(draft('15:00 Aさんは家族と話されていました')).toBe('15:00 Aさんは家族と話していました。');
  });

  it('時刻があれば、時間の言葉は空欄にしない', () => {
    expect(draft('午前中、10:00からAさんは体操に参加した')).toBe('午前中、10:00からAさんは体操に参加した。');
  });

  it('推測・感情・ラベルは注意として出す', () => {
    const r = polish('Aさんは徘徊していて、かわいそうだった。疲れていると思う');
    expect(r.notes.map((n) => n.kind)).toEqual(expect.arrayContaining(['speculation', 'feeling', 'label']));
  });

  it('事故の言葉があって報告がないときは、報告先を聞く', () => {
    const r = polish('10:05 Aさんが居室で転倒していた');
    expect(r.questions.some((q) => q.includes('報告'))).toBe(true);
  });

  it('空の文は何もしない', () => {
    expect(polish('  ').draft).toBe('');
  });
});
