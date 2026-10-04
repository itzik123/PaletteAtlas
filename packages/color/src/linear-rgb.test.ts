import { describe, expect, it } from 'vitest';
import { LinearRgb, MAX_BYTE, Srgb } from './index.ts';

/** Thousands of times smaller than one 8-bit step (1/255), so an error this small is invisible. */
const NEGLIGIBLE = 1e-6;

describe('LinearRgb', () => {
  it('decodes reference sRGB values to linear light', () => {
    // 0.5 -> 0.21404114 is mid grey in the color.js test suite. 0.04045 -> 0.0031308 is where
    // the straight segment of the sRGB curve meets its power segment (IEC 61966-2-1).
    const { r, g, b } = LinearRgb.fromSrgb(new Srgb(0.5, 0.04045, 1));
    expect([r, g, b]).toEqual([
      expect.closeTo(0.21404114, 7),
      expect.closeTo(0.0031308, 7),
      expect.closeTo(1, 7),
    ]);
  });

  it('round-trips every 8-bit level', () => {
    let maxError = 0;
    for (let level = 0; level <= MAX_BYTE; level++) {
      const color = Srgb.fromBytes(level, level, level);
      maxError = Math.max(maxError, Math.abs(LinearRgb.fromSrgb(color).toSrgb().r - color.r));
    }
    expect(maxError).toBeLessThan(NEGLIGIBLE);
  });
});
