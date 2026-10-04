import { describe, expect, it } from 'vitest';
import { OkLab, PalettePath, SeededRandom, Srgb } from './index.ts';

const SEED = 13;
const TRIALS = 20;
const PALETTE_SIZE = 6;

describe('PalettePath', () => {
  it('puts the darker end of the path first', () => {
    const random = new SeededRandom(SEED);
    for (let trial = 0; trial < TRIALS; trial++) {
      const palette = Array.from({ length: PALETTE_SIZE }, () => ({
        color: OkLab.fromSrgb(new Srgb(random.next(), random.next(), random.next())),
        share: 1 / PALETTE_SIZE,
      }));
      const { colors } = new PalettePath(palette);
      expect(colors[0].color.l).toBeLessThan(colors[PALETTE_SIZE - 1].color.l);
    }
  });
});
