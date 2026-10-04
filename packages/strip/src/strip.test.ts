import { extractPalette, KMeans, OkLab, type RgbaImage, SeededRandom, Srgb } from '@palette-atlas/color';
import { describe, expect, it } from 'vitest';
import { ColorAxis, ColumnAxis, RadialAxis, Strip } from './index.ts';

type Pixel = readonly [red: number, green: number, blue: number, alpha: number];

const OPAQUE = 255;
const BLACK: Pixel = [0, 0, 0, OPAQUE];
const WHITE: Pixel = [255, 255, 255, OPAQUE];
const RED: Pixel = [255, 0, 0, OPAQUE];
const BLUE: Pixel = [0, 0, 255, OPAQUE];
const LIME: Pixel = [0, 255, 0, OPAQUE];
const PALE_LIME: Pixel = [128, 255, 128, OPAQUE];
const TRANSPARENT: Pixel = [0, 0, 0, 0];

const SEED = 5;

/** An image of the given width, filled row by row with the given pixels. */
function image(width: number, ...pixels: readonly Pixel[]): RgbaImage {
  return { width, height: pixels.length / width, data: new Uint8ClampedArray(pixels.flat()) };
}

/** A strip's segment colors as hex codes, for readable comparisons. */
function hexes(strip: Strip): string[] {
  return Array.from({ length: strip.segmentCount }, (_, segment) => strip.colorAt(segment)?.toHex() ?? 'none');
}

/** A color axis that reads each image by its k-means palette of the given size. */
function colorAxis(paletteSize: number): ColorAxis {
  return new ColorAxis((picture) => extractPalette(picture, new KMeans(paletteSize, new SeededRandom(SEED))));
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

  it('reads colors along the shortest path through the palette, darker end first, each as long as its share', () => {
    // The shortest path in OKLab runs black, red, white, lime: neither by share nor by lightness.
    // The transparent pixel takes no room.
    const [K, R, W, G] = [BLACK, RED, WHITE, LIME];
    const picture = image(11, G, K, R, G, TRANSPARENT, W, K, G, R, K, G);
    expect(hexes(Strip.read(picture, colorAxis(4), 11))).toEqual([
      '#000000', '#000000', '#000000', '#ff0000', '#ff0000', '#ffffff', '#00ff00', '#00ff00', '#00ff00', '#00ff00',
    ]);
  });

  it("runs each color's pixels from the color before it toward the color after it", () => {
    // The path runs black, red, white, lime. Pale lime belongs to lime but leans toward white, so
    // it opens lime's stretch, although it is lighter than lime and comes after it in the image.
    const palette = [WHITE, LIME, BLACK, RED].map(([red, green, blue]) => ({
      color: OkLab.fromSrgb(Srgb.fromBytes(red, green, blue)),
      share: 1 / 4,
    }));
    const picture = image(5, LIME, WHITE, PALE_LIME, BLACK, RED);
    expect(hexes(Strip.read(picture, new ColorAxis(() => palette), 5))).toEqual([
      '#000000', '#ff0000', '#ffffff', '#80ff80', '#00ff00',
    ]);
  });

  it("folds back into the image, painting every pixel with its segment's color", () => {
    const folded = Strip.read(image(4, RED, BLACK, WHITE, BLUE), new ColumnAxis(), 2).foldBack();
    const [darkRed, paleBlue] = [[188, 0, 0, OPAQUE], [188, 188, 255, OPAQUE]];
    expect(Array.from(folded.data)).toEqual([...darkRed, ...darkRed, ...paleBlue, ...paleBlue]);
  });

  it.each([
    ['columns', new ColumnAxis()],
    ['colors', colorAxis(2)],
  ])('restores the image exactly when every pixel is its own segment, reading %s', (_, axis) => {
    const picture = image(4, RED, BLACK, WHITE, BLUE);
    expect(Strip.read(picture, axis, 4).foldBack().data).toEqual(picture.data);
  });
});
