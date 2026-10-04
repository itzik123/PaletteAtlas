import { describe, expect, it } from 'vitest';
import { BYTES_PER_PIXEL, downscale, LinearRgb, type RgbaImage } from './index.ts';

type Pixel = readonly [red: number, green: number, blue: number, alpha: number];

const OPAQUE = 255;
const TRANSPARENT = 0;
const BLACK: Pixel = [0, 0, 0, OPAQUE];
const WHITE: Pixel = [255, 255, 255, OPAQUE];

/** An image of the given width, filled row by row with the given pixels. */
function image(width: number, ...pixels: readonly Pixel[]): RgbaImage {
  return { width, height: pixels.length / width, data: new Uint8ClampedArray(pixels.flat()) };
}

/** An image's pixels as [red, green, blue, alpha] arrays, for readable comparisons. */
function pixelsOf({ data }: RgbaImage): number[][] {
  return Array.from({ length: data.length / BYTES_PER_PIXEL }, (_, index) =>
    Array.from(data.subarray(index * BYTES_PER_PIXEL, (index + 1) * BYTES_PER_PIXEL)),
  );
}

describe('downscale', () => {
  it('averages light, not stored values', () => {
    const checkerboard = image(2, BLACK, WHITE, WHITE, BLACK);
    expect(pixelsOf(downscale(checkerboard, 1))).toEqual([[188, 188, 188, OPAQUE]]);
  });

  it('weights partly covered pixels by the area they overlap', () => {
    // Three pixels into two: each new pixel covers one black pixel and half of the white one.
    const third = [...new LinearRgb(1 / 3, 1 / 3, 1 / 3).toSrgb().toBytes(), OPAQUE];
    expect(pixelsOf(downscale(image(3, BLACK, WHITE, BLACK), 2))).toEqual([third, third]);
  });

  it('keeps transparent pixels from darkening their neighbors', () => {
    const redBesideTransparent = image(2, [255, 0, 0, OPAQUE], [0, 0, 0, TRANSPARENT]);
    expect(pixelsOf(downscale(redBesideTransparent, 1))).toEqual([[255, 0, 0, 128]]);
  });

  it('returns an image that already fits as it is', () => {
    const small = image(2, BLACK, WHITE);
    expect(downscale(small, 2)).toBe(small);
  });
});
