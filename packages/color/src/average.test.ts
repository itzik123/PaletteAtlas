import { describe, expect, it } from 'vitest';
import { LinearRgb, OkLab, type RgbaImage, Srgb } from './index.ts';

type Pixel = readonly [red: number, green: number, blue: number, alpha: number];

const OPAQUE = 255;
const TRANSPARENT = 0;

/** A one-row image of the given pixels. */
function row(...pixels: readonly Pixel[]): RgbaImage {
  return { width: pixels.length, height: 1, data: new Uint8ClampedArray(pixels.flat()) };
}

describe('averaging an image', () => {
  it('blends black and white differently in each space', () => {
    const blackAndWhite = row([0, 0, 0, OPAQUE], [255, 255, 255, OPAQUE]);
    // Averaging the gamma-encoded values gives #808080, which emits only 21% of white's light.
    expect(Srgb.average(blackAndWhite)?.toHex()).toBe('#808080');
    // Linear light emits exactly half: the gray the pair blends into from a distance.
    expect(LinearRgb.average(blackAndWhite)?.toSrgb().toHex()).toBe('#bcbcbc');
    // OKLab lands halfway in perceived lightness.
    expect(OkLab.average(blackAndWhite)?.toSrgb().toHex()).toBe('#636363');
  });

  it('keeps the color of a uniform image in every space', () => {
    const uniform = row([51, 102, 153, OPAQUE], [51, 102, 153, OPAQUE]);
    expect(Srgb.average(uniform)?.toHex()).toBe('#336699');
    expect(LinearRgb.average(uniform)?.toSrgb().toHex()).toBe('#336699');
    expect(OkLab.average(uniform)?.toSrgb().toHex()).toBe('#336699');
  });

  it('weights pixels by alpha, so transparent ones count for nothing', () => {
    const redBesideHiddenBlue = row([255, 0, 0, OPAQUE], [0, 0, 255, TRANSPARENT]);
    expect(LinearRgb.average(redBesideHiddenBlue)?.toSrgb().toHex()).toBe('#ff0000');
    expect(LinearRgb.average(row([0, 0, 255, TRANSPARENT]))).toBeUndefined();
  });
});
