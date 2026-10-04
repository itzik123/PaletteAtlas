import { describe, expect, it } from 'vitest';
import { MAX_BYTE, Srgb } from './index.ts';

describe('Srgb', () => {
  it('round-trips every 8-bit level through bytes', () => {
    for (let level = 0; level <= MAX_BYTE; level++) {
      expect(Srgb.fromBytes(level, level, level).toBytes()).toEqual([level, level, level]);
    }
  });

  it('clips colors outside the sRGB gamut to the nearest byte', () => {
    const outOfGamut = new Srgb(-0.2, 0.5, 1.3);
    expect(outOfGamut.toBytes()).toEqual([0, 128, 255]);
    expect(outOfGamut.toHex()).toBe('#0080ff');
  });
});
