import { BYTES_PER_PIXEL, type RgbaImage } from '@palette-atlas/color';
import { describe, expect, it } from 'vitest';
import { ColumnAxis, RadialAxis, type StripAxis } from './index.ts';

const AXES: readonly (readonly [name: string, axis: StripAxis])[] = [
  ['ColumnAxis', new ColumnAxis()],
  ['RadialAxis', new RadialAxis()],
];
const SIZES = [[1, 1], [7, 5], [5, 7], [64, 48]] as const;
const SEGMENT_COUNTS = [1, 3, 16, 1000];

function blank(width: number, height: number): RgbaImage {
  return { width, height, data: new Uint8ClampedArray(width * height * BYTES_PER_PIXEL) };
}

describe.each(AXES)('%s', (_, axis) => {
  it('puts every pixel in a segment and leaves no segment empty', () => {
    for (const [width, height] of SIZES) {
      for (const segments of SEGMENT_COUNTS) {
        const map = axis.sourceMap(blank(width, height), segments);
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
