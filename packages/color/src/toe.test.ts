import { describe, expect, it } from 'vitest';
import { OkLab, Srgb, toe, toeInverse } from './index.ts';

// Toe-corrected lightness, the first coordinate of OKLrab, from the color.js test suite.
const REFERENCES = [
  { name: 'red', srgb: [1, 0, 0], lightness: 0.5680846563197034 },
  { name: 'lime', srgb: [0, 1, 0], lightness: 0.8445289714936317 },
  { name: 'blue', srgb: [0, 0, 1], lightness: 0.3665653391870817 },
  { name: 'white', srgb: [1, 1, 1], lightness: 1 },
] as const;

/** color.js derives its OKLab matrices separately, so lightness agrees to about 1e-8. */
const REFERENCE_DIGITS = 6;
const ROUND_TRIP_STEPS = 1000;
const NEGLIGIBLE = 1e-12;

describe('toe', () => {
  it.each(REFERENCES)('matches the reference lightness of $name', ({ srgb: [r, g, b], lightness }) => {
    expect(toe(OkLab.fromSrgb(new Srgb(r, g, b)).l)).toBeCloseTo(lightness, REFERENCE_DIGITS);
  });

  it('round-trips lightness through its inverse', () => {
    let maxError = 0;
    for (let step = 0; step <= ROUND_TRIP_STEPS; step++) {
      const lightness = step / ROUND_TRIP_STEPS;
      maxError = Math.max(maxError, Math.abs(toeInverse(toe(lightness)) - lightness));
    }
    expect(maxError).toBeLessThan(NEGLIGIBLE);
  });
});
