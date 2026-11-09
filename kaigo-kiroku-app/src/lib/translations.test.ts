import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';
import { my, myKeys } from './myanmar';
import { sourceRows } from './translationRows';

const csv = parseCsv(readFileSync('translations/myanmar.csv', 'utf8'));

describe('translations/myanmar.csv', () => {
  it('has the expected header', () => {
    expect(csv[0]).toEqual(['key', '種類', '日本語（原文・参考）', 'ミャンマー語', '確認済み']);
  });
  it('has exactly one row per translatable item (run `npm run my:sync` if this fails)', () => {
    const keys = csv.slice(1).map((r) => r[0]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.sort()).toEqual(sourceRows().map((r) => r[0]).sort());
  });
  it('is loaded by the app', () => {
    expect(myKeys().length).toBeGreaterThan(300);
    expect(my('category.vital')).toBeTruthy();
    expect(my('no.such.key')).toBeUndefined();
  });
});

describe('parseCsv', () => {
  it('handles quotes, commas, newlines and BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, ""y""","line1\nline2"\r\n')).toEqual([['a', 'b'], ['x, "y"', 'line1\nline2']]);
  });
});
