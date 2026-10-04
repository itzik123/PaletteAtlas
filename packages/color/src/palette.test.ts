import { describe, expect, it } from 'vitest';
import { type Clusterer, extractPalette, KMeans, MAX_BYTE, type RgbaImage, SeededRandom, type WeightedPoints } from './index.ts';

type Rgb = readonly [red: number, green: number, blue: number];

const SEED = 7;
/** An alpha of 51 out of 255: a pixel at 20% opacity. */
const FIFTH_OPAQUE = 51;

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

  it('clusters each distinct visible color once, weighted by the opacity of all its pixels', () => {
    const received: WeightedPoints[] = [];
    const recorder: Clusterer = {
      cluster: (points) => {
        received.push(points);
        return [];
      },
    };
    const [red, blue, hiddenGreen] = [[255, 0, 0], [0, 0, 255], [0, 255, 0]];
    const pixels = [
      [...red, MAX_BYTE], [...blue, MAX_BYTE], [...red, MAX_BYTE], [...red, FIFTH_OPAQUE],
      [...blue, MAX_BYTE], [...red, MAX_BYTE], [...hiddenGreen, 0],
    ];
    extractPalette({ width: pixels.length, height: 1, data: new Uint8ClampedArray(pixels.flat()) }, recorder);
    // Blue: two opaque pixels. Red: three opaque pixels and one at 20%. Green is invisible.
    const [{ coordinates, weights }] = received;
    expect(coordinates).toHaveLength(2 * 3);
    expect(Array.from(weights).toSorted((a, b) => a - b)).toEqual([expect.closeTo(2), expect.closeTo(3.2)]);
  });

  it('gives the same palette for the same seed', () => {
    const ramp = flatColors(...Array.from({ length: 64 }, (_, level): [Rgb, number] => [[level * 4, 255 - level * 4, 128], 1]));
    const palette = () => summarize(ramp, new KMeans(4, new SeededRandom(SEED)));
    expect(palette()).toEqual(palette());
  });
});
