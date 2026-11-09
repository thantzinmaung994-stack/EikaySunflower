import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderSite } from './site';

describe('public web pages (docs/kaigo-kiroku)', () => {
  it('match the in-app text (run `npm run site` if this fails)', () => {
    for (const [name, html] of Object.entries(renderSite())) {
      expect(readFileSync(`../docs/kaigo-kiroku/${name}`, 'utf8'), name).toBe(html);
    }
  });
  it('contain the items App Store review looks for', () => {
    const s = renderSite();
    expect(s['privacy.html']).toContain('RevenueCat');
    expect(s['terms.html']).toContain('自動');
    expect(s['support.html']).toContain('info.eikaysunflower@gmail.com');
  });
});
