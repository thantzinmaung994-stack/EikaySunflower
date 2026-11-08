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
});
