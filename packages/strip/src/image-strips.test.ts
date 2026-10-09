import { BYTES_PER_PIXEL, Channel, MAX_BYTE, type RgbaImage, SeededRandom } from '@palette-atlas/color';
import { describe, expect, it } from 'vitest';
import { ImageStrips } from './index.ts';

const SEED = 7;

/** An opaque image of random colors. */
function noise(width: number, height: number): RgbaImage {
  const random = new SeededRandom(SEED);
  const data = new Uint8ClampedArray(width * height * BYTES_PER_PIXEL);
  for (let offset = 0; offset < data.length; offset++) {
    data[offset] = offset % BYTES_PER_PIXEL === Channel.alpha ? MAX_BYTE : random.next() * MAX_BYTE;
  }
  return { width, height, data };
}

describe('ImageStrips', () => {
  it('reads only the axes asked for, in the order asked, each strip as reading every axis gives it', () => {
    const image = noise(40, 30);
    const every = ImageStrips.read(image);
    const some = ImageStrips.read(image, ['color', 'columns']);
    expect(some.strips.map(({ axis }) => axis)).toEqual(['color', 'columns']);
    for (const { axis, strip } of some.strips) {
      expect(strip.toImage()).toEqual(every.strips.find((named) => named.axis === axis)?.strip.toImage());
    }
  });
});
