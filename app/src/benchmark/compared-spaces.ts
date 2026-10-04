import { LinearRgb, OkLab, type RgbaImage, Srgb } from '@palette-atlas/color';

/**
 * A color space the benchmark compares. Strategy: each one averages and mixes colors in its
 * own space, and the page shows them side by side.
 */
export interface ComparedSpace {
  readonly name: string;
  /** The mean color of an image's pixels, averaged in this space. */
  average(image: RgbaImage): Srgb | undefined;
  /** The colors on the way from one color to another, mixed in this space (t = 0 gives from). */
  gradient(from: Srgb, to: Srgb): (t: number) => Srgb;
}

export const COMPARED_SPACES: readonly ComparedSpace[] = [
  {
    name: 'sRGB',
    average: (image) => Srgb.average(image),
    gradient: (from, to) => (t) => from.mix(to, t),
  },
  {
    name: 'Linear light',
    average: (image) => LinearRgb.average(image)?.toSrgb(),
    gradient: (from, to) => {
      const start = LinearRgb.fromSrgb(from);
      const end = LinearRgb.fromSrgb(to);
      return (t) => start.mix(end, t).toSrgb();
    },
  },
  {
    name: 'OKLab',
    average: (image) => OkLab.average(image)?.toSrgb(),
    gradient: (from, to) => {
      const start = OkLab.fromSrgb(from);
      const end = OkLab.fromSrgb(to);
      return (t) => start.mix(end, t).toSrgb();
    },
  },
];
