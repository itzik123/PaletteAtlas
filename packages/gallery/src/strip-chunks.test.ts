import { BYTES_PER_PIXEL, type RgbaImage } from '@palette-atlas/color';
import { describe, expect, it } from 'vitest';
import { chunkOf, packStrips, stripInRow } from './strip-chunks.ts';

const SEGMENTS = 3;

/** A strip of SEGMENTS opaque pixels whose bytes all derive from the seed. */
function strip(seed: number): RgbaImage {
  const data = new Uint8ClampedArray(SEGMENTS * BYTES_PER_PIXEL).map((_, byte) => (byte % 4 === 3 ? 255 : seed * 16 + byte));
  return { width: SEGMENTS, height: 1, data };
}

describe('strip chunks', () => {
  it('packs strips into chunk images, a row each, and reads every one back from its row', () => {
    const strips = [0, 1, 2, 3, 4].map(strip);
    const chunks = packStrips(strips, SEGMENTS, 2);
    expect(chunks.map(({ width, height }) => [width, height])).toEqual([
      [SEGMENTS, 2],
      [SEGMENTS, 2],
      [SEGMENTS, 1],
    ]);
    strips.forEach((expected, position) => {
      const { chunk, row } = chunkOf(position, 2);
      expect(stripInRow(chunks[chunk], row)).toEqual(expected);
    });
  });

  it('refuses a strip of another length', () => {
    expect(() => packStrips([{ width: SEGMENTS - 1, height: 1, data: new Uint8ClampedArray(8) }], SEGMENTS, 2)).toThrow(RangeError);
  });
});
