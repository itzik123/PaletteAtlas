import type { RgbaImage } from '@palette-atlas/color';
import { describe, expect, it } from 'vitest';
import { ColumnAxis, RadialAxis, Strip } from './index.ts';

type Pixel = readonly [red: number, green: number, blue: number, alpha: number];

const OPAQUE = 255;
const BLACK: Pixel = [0, 0, 0, OPAQUE];
const WHITE: Pixel = [255, 255, 255, OPAQUE];
const RED: Pixel = [255, 0, 0, OPAQUE];
const BLUE: Pixel = [0, 0, 255, OPAQUE];

/** An image of the given width, filled row by row with the given pixels. */
function image(width: number, ...pixels: readonly Pixel[]): RgbaImage {
  return { width, height: pixels.length / width, data: new Uint8ClampedArray(pixels.flat()) };
}

/** A strip's segment colors as hex codes, for readable comparisons. */
function hexes(strip: Strip): string[] {
  return Array.from({ length: strip.segmentCount }, (_, segment) => strip.colorAt(segment)?.toHex() ?? 'none');
}

describe('Strip', () => {
  it('reads columns left to right, averaging each band in linear light', () => {
    const picture = image(4, RED, BLACK, WHITE, BLUE);
    expect(hexes(Strip.read(picture, new ColumnAxis(), 2))).toEqual(['#bc0000', '#bcbcff']);
  });

  it('reads rings from the center outward', () => {
    // A white 2×2 center inside a black border.
    const [B, W] = [BLACK, WHITE];
    const picture = image(4, B, B, B, B, B, W, W, B, B, W, W, B, B, B, B, B);
    expect(hexes(Strip.read(picture, new RadialAxis(), 2))).toEqual(['#ffffff', '#000000']);
  });

  it("folds back into the image, painting every pixel with its segment's color", () => {
    const folded = Strip.read(image(4, RED, BLACK, WHITE, BLUE), new ColumnAxis(), 2).foldBack();
    const [darkRed, paleBlue] = [[188, 0, 0, OPAQUE], [188, 188, 255, OPAQUE]];
    expect(Array.from(folded.data)).toEqual([...darkRed, ...darkRed, ...paleBlue, ...paleBlue]);
  });

  it('restores the image exactly when every pixel is its own segment', () => {
    const picture = image(4, RED, BLACK, WHITE, BLUE);
    expect(Strip.read(picture, new ColumnAxis(), 4).foldBack().data).toEqual(picture.data);
  });
});
