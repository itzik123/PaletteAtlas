import { describe, expect, it } from 'vitest';
import { extractPalette, KMeans, MAX_BYTE, type RgbaImage, SeededRandom } from './index.ts';

type Rgb = readonly [red: number, green: number, blue: number];

const SEED = 7;

/** A one-row image of flat colors, each repeated count times. */
function flatColors(...runs: readonly (readonly [color: Rgb, count: number])[]): RgbaImage {
  const pixels = runs.flatMap(([color, count]) => Array.from({ length: count }, () => [...color, MAX_BYTE]));
  return { width: pixels.length, height: 1, data: new Uint8ClampedArray(pixels.flat()) };
}

/** A palette as [hex, share] pairs, for readable comparisons. */
function summarize(image: RgbaImage, kmeans: KMeans): (readonly [string, number])[] {
  return extractPalette(image, kmeans).map(({ color, share }) => [color.toSrgb().toHex(), share]);
}

describe('extractPalette', () => {
  it('finds the colors of a flat image and the share of each, largest first', () => {
    const image = flatColors([[0, 0, 255], 30], [[255, 0, 0], 50], [[255, 255, 255], 20]);
    expect(summarize(image, new KMeans(3, new SeededRandom(SEED)))).toEqual([
      ['#ff0000', 0.5],
      ['#0000ff', 0.3],
      ['#ffffff', 0.2],
    ]);
  });

  it('groups near-blacks that look alike, leaving room for distinct colors', () => {
    // Like the galaxy render: mostly three near-blacks that look the same on screen.
    const image = flatColors(
      [[0, 0, 0], 60],
      [[4, 4, 4], 11],
      [[20, 18, 20], 10],
      [[255, 255, 255], 4],
      [[255, 128, 255], 3],
    );
    const palette = summarize(image, new KMeans(3, new SeededRandom(SEED)));
    expect(palette.map(([, share]) => share)).toEqual([81 / 88, 4 / 88, 3 / 88]);
    expect(palette.slice(1).map(([hex]) => hex)).toEqual(['#ffffff', '#ff80ff']);
  });

  it('returns fewer colors than asked when the image has fewer', () => {
    const blackAndWhite = flatColors([[0, 0, 0], 10], [[255, 255, 255], 10]);
    expect(summarize(blackAndWhite, new KMeans(5, new SeededRandom(SEED)))).toHaveLength(2);
  });

  it('gives the same palette for the same seed', () => {
    const ramp = flatColors(...Array.from({ length: 64 }, (_, level): [Rgb, number] => [[level * 4, 255 - level * 4, 128], 1]));
    const palette = () => summarize(ramp, new KMeans(4, new SeededRandom(SEED)));
    expect(palette()).toEqual(palette());
  });
});
