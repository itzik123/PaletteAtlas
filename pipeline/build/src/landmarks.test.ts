import { BYTES_PER_PIXEL, MAX_BYTE, type RgbaImage } from '@palette-atlas/color';
import { Vectors } from '@palette-atlas/hnsw';
import { STRIP_SEGMENTS } from '@palette-atlas/strip';
import { COLOR_SCHEME_LENGTH, colorSchemeVector } from '@palette-atlas/vectorize';
import { describe, expect, it } from 'vitest';
import { LANDMARK_COUNT, landmarks } from './landmarks.ts';

/** Eight colors far apart, from near-black to near-white, as a gallery's families are. */
const FAMILY_COLORS = [
  [20, 18, 16],
  [236, 232, 222],
  [190, 45, 30],
  [45, 140, 70],
  [40, 60, 180],
  [225, 190, 50],
  [110, 75, 45],
  [130, 132, 140],
] as const;
const FAMILY_SIZE = 15;
/** How far apart, in each channel, two strips of a family are. */
const STEP = 3;

/** A strip of one color, its every segment the same. */
function solidStrip([red, green, blue]: readonly number[]): RgbaImage {
  const data = new Uint8ClampedArray(STRIP_SEGMENTS * BYTES_PER_PIXEL);
  for (let segment = 0; segment < STRIP_SEGMENTS; segment++) data.set([red, green, blue, MAX_BYTE], segment * BYTES_PER_PIXEL);
  return { width: STRIP_SEGMENTS, height: 1, data };
}

describe('landmarks', () => {
  it('picks one painting from each color family, the one most like the rest of its family', () => {
    // Each family's strips step from darker to lighter around its color; the middle one is its color.
    const strips = FAMILY_COLORS.flatMap((color) =>
      Array.from({ length: FAMILY_SIZE }, (_, member) => solidStrip(color.map((channel) => channel + (member - (FAMILY_SIZE - 1) / 2) * STEP))),
    );
    const data = new Float32Array(strips.length * COLOR_SCHEME_LENGTH);
    strips.forEach((strip, painting) => data.set(colorSchemeVector(strip), painting * COLOR_SCHEME_LENGTH));
    const middles = FAMILY_COLORS.map((_, family) => family * FAMILY_SIZE + (FAMILY_SIZE - 1) / 2);
    expect(LANDMARK_COUNT).toBe(FAMILY_COLORS.length);
    expect([...landmarks(strips, new Vectors(COLOR_SCHEME_LENGTH, data))].sort((first, second) => first - second)).toEqual(middles);
  });
});
