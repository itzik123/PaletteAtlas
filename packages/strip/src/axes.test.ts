import { BYTES_PER_PIXEL, Channel, extractPalette, KMeans, MAX_BYTE, type RgbaImage, SeededRandom } from '@palette-atlas/color';
import { describe, expect, it } from 'vitest';
import { ColorAxis, ColumnAxis, HilbertAxis, RadialAxis, type StripAxis } from './index.ts';

const SEED = 3;
const PALETTE_SIZE = 4;
const AXES: readonly (readonly [name: string, axis: StripAxis])[] = [
  ['ColumnAxis', new ColumnAxis()],
  ['RadialAxis', new RadialAxis()],
  ['HilbertAxis', new HilbertAxis()],
  ['ColorAxis', new ColorAxis((image) => extractPalette(image, new KMeans(PALETTE_SIZE, new SeededRandom(SEED))))],
];
const SIZES = [[1, 1], [7, 5], [5, 7], [64, 48]] as const;
const SEGMENT_COUNTS = [1, 3, 16, 1000];

/** An opaque image of random colors, so that every axis has something to read. */
function noise(width: number, height: number): RgbaImage {
  const random = new SeededRandom(SEED);
  const data = new Uint8ClampedArray(width * height * BYTES_PER_PIXEL);
  for (let offset = 0; offset < data.length; offset++) {
    data[offset] = offset % BYTES_PER_PIXEL === Channel.alpha ? MAX_BYTE : random.next() * MAX_BYTE;
  }
  return { width, height, data };
}

/** How many pixels of a width × height image each segment of the axis gets. */
function pixelsPerSegment(axis: StripAxis, width: number, height: number, segments: number): number[] {
  const map = axis.sourceMap(noise(width, height), segments);
  const counts = new Array<number>(map.segmentCount).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) counts[map.segmentAt(x, y)]++;
  }
  return counts;
}

describe('RadialAxis', () => {
  it('gives every ring the same number of pixels, give or take one', () => {
    for (const [width, height] of [[7, 5], [64, 48], [256, 256], [256, 144]]) {
      for (const segments of [3, 16, 128]) {
        const counts = pixelsPerSegment(new RadialAxis(), width, height, segments);
        expect(Math.max(...counts) - Math.min(...counts), `${width} × ${height}, ${segments} rings`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe.each(AXES)('%s', (_, axis) => {
  it('puts every pixel in a segment and leaves no segment empty', () => {
    for (const [width, height] of SIZES) {
      for (const segments of SEGMENT_COUNTS) {
        const map = axis.sourceMap(noise(width, height), segments);
        const pixelsPerSegment = new Array<number>(map.segmentCount).fill(0);
        let unmapped = 0;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const segment = map.segmentAt(x, y);
            if (segment < 0) unmapped++;
            else pixelsPerSegment[segment]++;
          }
        }
        expect(map.segmentCount).toBeLessThanOrEqual(segments);
        expect(unmapped).toBe(0);
        expect(pixelsPerSegment).not.toContain(0);
      }
    }
  });
});
