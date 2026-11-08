import { describe, expect, it } from 'vitest';
import { autoRuby, toPieces } from './Ruby';

describe('furigana', () => {
  it('uses the longest dictionary word', () => {
    expect(autoRuby('体位変換をした')).toEqual([{ base: '体位変換', rt: 'たいいへんかん' }, 'をした']);
  });
  it('leaves unknown kanji without reading', () => {
    expect(autoRuby('猫')).toEqual(['猫']);
  });
  it('lets manual 《》 readings win', () => {
    expect(toPieces('褥瘡《じょくそう》予防')).toEqual([{ base: '褥瘡', rt: 'じょくそう' }, '予防']);
  });
  it('does not read words across a counter', () => {
    expect(autoRuby('1日3回内服した')).not.toContainEqual(expect.objectContaining({ base: '回内' }));
    expect(autoRuby('入れ歯が2回外れた')).not.toContainEqual(expect.objectContaining({ base: '回外' }));
    expect(autoRuby('日本人に多い')[0]).toEqual({ base: '日本人', rt: 'にほんじん' });
  });
});
