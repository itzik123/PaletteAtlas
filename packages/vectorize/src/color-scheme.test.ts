import { BYTES_PER_PIXEL, bytesToOkLrab, MAX_BYTE, type Random, type RgbaImage, SeededRandom } from '@palette-atlas/color';
import { ImageStrips } from '@palette-atlas/strip';
import { describe, expect, it } from 'vitest';
import { COLOR_SCHEME_LENGTH, colorSchemeDistance, colorSchemeVector } from './index.ts';

const SEED = 9;
type Color = readonly [red: number, green: number, blue: number];

function randomColors(count: number, random: Random): Color[] {
  return Array.from({ length: count }, () => [0, 0, 0].map(() => Math.floor(random.next() * (MAX_BYTE + 1))) as unknown as Color);
}

/** An opaque strip, a segment per color. */
function strip(colors: readonly Color[]): RgbaImage {
  return { width: colors.length, height: 1, data: Uint8ClampedArray.from(colors.flatMap((color) => [...color, MAX_BYTE])) };
}

function distance(first: RgbaImage, second: RgbaImage): number {
  return colorSchemeDistance(colorSchemeVector(first), 0, colorSchemeVector(second), 0, COLOR_SCHEME_LENGTH);
}

/** Every order of the items (Heap's algorithm), for small lists. */
function* permutations(items: number[], count = items.length): Generator<readonly number[]> {
  if (count <= 1) {
    yield items;
    return;
  }
  for (let index = 0; index < count; index++) {
    yield* permutations(items, count - 1);
    const swap = count % 2 === 0 ? index : 0;
    [items[swap], items[count - 1]] = [items[count - 1], items[swap]];
  }
}

/**
 * The Earth Mover's Distance between two strips of as many segments, each segment an equal share of
 * its picture: the least mean distance in OKLrab over every way to pair the segments up.
 */
function earthMoversDistance(first: readonly Color[], second: readonly Color[]): number {
  const okLrab = (color: Color): Float64Array => {
    const out = new Float64Array(3);
    bytesToOkLrab(...color, out);
    return out;
  };
  const from = first.map(okLrab);
  const to = second.map(okLrab);
  let least = Number.POSITIVE_INFINITY;
  for (const pairing of permutations(from.map((_, index) => index))) {
    const total = pairing.reduce((sum, target, source) => sum + Math.hypot(...from[source].map((value, axis) => value - to[target][axis])), 0);
    least = Math.min(least, total / from.length);
  }
  return least;
}

describe('colorSchemeVector', () => {
  it('depends only on the colors and their shares, not on their order or the strip’s length', () => {
    const random = new SeededRandom(SEED);
    const colors = randomColors(16, random);
    const shuffled = colors.map((color) => ({ color, key: random.next() })).sort((a, b) => a.key - b.key).map(({ color }) => color);
    expect(colorSchemeVector(strip(shuffled))).toEqual(colorSchemeVector(strip(colors)));
    // Each color 8 times over 128 segments has the same shares as each once over 16.
    const repeated = colors.flatMap((color) => Array.from({ length: 8 }, () => color));
    expect(distance(strip(repeated), strip(colors))).toBeCloseTo(0, 12);
  });

  it('never puts two strips further apart than the Earth Mover’s Distance between their colors', () => {
    const random = new SeededRandom(SEED);
    for (let pair = 0; pair < 40; pair++) {
      const first = randomColors(6, random);
      const second = randomColors(6, random);
      expect(distance(strip(first), strip(second))).toBeLessThanOrEqual(earthMoversDistance(first, second) + 1e-9);
    }
  });

  it('leaves out segments with no visible color, and refuses a strip with none', () => {
    const colors = randomColors(4, new SeededRandom(SEED));
    const withHole = strip(colors);
    const hidden = { width: 5, height: 1, data: Uint8ClampedArray.from([...withHole.data, 0, 0, 0, 0]) };
    expect(colorSchemeVector(hidden)).toEqual(colorSchemeVector(withHole));
    expect(() => colorSchemeVector({ width: 2, height: 1, data: new Uint8ClampedArray(2 * BYTES_PER_PIXEL) })).toThrow(RangeError);
  });
});

describe('an image’s color scheme, from its color strip', () => {
  /** Blocks of four colors with some grain, like a small painting; `shift` adds to every channel. */
  function picture(colors: readonly Color[], shift = 0): RgbaImage {
    const random = new SeededRandom(SEED);
    const [width, height] = [64, 48];
    const data = new Uint8ClampedArray(width * height * BYTES_PER_PIXEL);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = colors[(x < width / 2 ? 0 : 1) + (y < height / 3 ? 0 : 2)];
        const offset = (y * width + x) * BYTES_PER_PIXEL;
        for (let channel = 0; channel < 3; channel++) data[offset + channel] = color[channel] + shift + (random.next() - 0.5) * 24;
        data[offset + 3] = MAX_BYTE;
      }
    }
    return { width, height, data };
  }
  const vectorOf = (image: RgbaImage): Float32Array =>
    colorSchemeVector(ImageStrips.read(image).strips.find(({ axis }) => axis === 'color')?.strip.toImage() ?? strip([]));
  const between = (first: Float32Array, second: Float32Array): number => colorSchemeDistance(first, 0, second, 0, COLOR_SCHEME_LENGTH);
  /** CSS Color 4's just noticeable difference in OKLab. */
  const JUST_NOTICEABLE = 0.02;

  it('is 0 for the same image, and below a just noticeable difference for a slightly brighter copy', () => {
    const colors: Color[] = [[180, 60, 40], [30, 70, 160], [220, 200, 120], [40, 110, 60]];
    const image = vectorOf(picture(colors));
    expect(between(image, vectorOf(picture(colors)))).toBe(0);
    const brighter = between(image, vectorOf(picture(colors, 3)));
    expect(brighter).toBeGreaterThan(0);
    expect(brighter).toBeLessThan(JUST_NOTICEABLE);
    const other = between(image, vectorOf(picture([[90, 40, 120], [200, 170, 160], [20, 20, 30], [240, 230, 220]])));
    expect(other).toBeGreaterThan(10 * brighter);
  });
});
