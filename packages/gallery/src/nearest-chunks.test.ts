import { describe, expect, it } from 'vitest';
import { nearestInRow, packNearest } from './nearest-chunks.ts';

describe('nearest chunks', () => {
  it('packs each painting’s nearest, in order, and reads them back from its row, a short list as short', () => {
    const lists = [[5, 0, 65_534], [7], []];
    const bytes = packNearest(lists, 3);
    expect(bytes.length).toBe(3 * 3 * 2);
    expect(lists.map((_, row) => nearestInRow(bytes, row, 3))).toEqual(lists);
  });

  it('refuses a position that doesn’t fit, and a list too long', () => {
    expect(() => packNearest([[65_535]], 1)).toThrow(RangeError);
    expect(() => packNearest([[1, 2]], 1)).toThrow(RangeError);
  });
});
