import { describe, expect, it } from 'vitest';
import { OkLab, Srgb } from './index.ts';

// sRGB to OKLab reference values from the color.js test suite, written by the CSS Color 4 editors.
const REFERENCES = [
  { name: 'white', srgb: [1, 1, 1], oklab: [1, 0, 0] },
  { name: 'black', srgb: [0, 0, 0], oklab: [0, 0, 0] },
  { name: 'red', srgb: [1, 0, 0], oklab: [0.627955, 0.224863, 0.125846] },
  { name: 'lime', srgb: [0, 1, 0], oklab: [0.86644, -0.233888, 0.179498] },
  { name: 'blue', srgb: [0, 0, 1], oklab: [0.452014, -0.032457, -0.311528] },
  { name: 'cyan', srgb: [0, 1, 1], oklab: [0.905399, -0.149444, -0.039398] },
  { name: 'magenta', srgb: [1, 0, 1], oklab: [0.701674, 0.274566, -0.169156] },
  { name: 'yellow', srgb: [1, 1, 0], oklab: [0.967983, -0.071369, 0.19857] },
] as const;

/** The references are rounded to 6 decimals; matching 5 leaves room for that rounding. */
const REFERENCE_DIGITS = 5;
const MAX_BYTE = 255;
/** 0, 17, 34, ..., 255: 16 levels per channel, 4096 colors in all. */
const LATTICE_STEP = 17;
/** Thousands of times smaller than one 8-bit step (1/255), so an error this small is invisible. */
const NEGLIGIBLE = 1e-6;

describe('OkLab', () => {
  it.each(REFERENCES)('converts $name from sRGB', ({ srgb: [r, g, b], oklab }) => {
    const color = OkLab.fromSrgb(new Srgb(r, g, b));
    expect([color.l, color.a, color.b]).toEqual(
      oklab.map((value) => expect.closeTo(value, REFERENCE_DIGITS)),
    );
  });

  it('round-trips sRGB colors within a negligible error', () => {
    let maxError = 0;
    for (let r = 0; r <= MAX_BYTE; r += LATTICE_STEP) {
      for (let g = 0; g <= MAX_BYTE; g += LATTICE_STEP) {
        for (let b = 0; b <= MAX_BYTE; b += LATTICE_STEP) {
          const color = Srgb.fromBytes(r, g, b);
          const back = OkLab.fromSrgb(color).toSrgb();
          maxError = Math.max(
            maxError,
            Math.abs(back.r - color.r),
            Math.abs(back.g - color.g),
            Math.abs(back.b - color.b),
          );
        }
      }
    }
    expect(maxError).toBeLessThan(NEGLIGIBLE);
  });
});
