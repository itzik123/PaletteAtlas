import { byteToLinear, LinearRgb } from './linear-rgb.ts';
import { lerp } from './lerp.ts';
import { invert, type Matrix3, transform } from './matrix3.ts';
import { meanOfPixels } from './pixel-mean.ts';
import type { RgbaImage } from './rgba-image.ts';
import type { Srgb } from './srgb.ts';

// The forward matrices are from Björn Ottosson, "A perceptual color space for image
// processing" (2020), as revised on 2021-01-25: https://bottosson.github.io/posts/oklab/
// The inverses are computed here instead of copied: the published ones are rounded
// separately and undo the forward matrices only to about 1e-7, which shows in round trips.

/** Linear sRGB to cone responses (LMS): Ottosson's M1 combined with the sRGB-to-XYZ matrix. */
const LINEAR_SRGB_TO_LMS: Matrix3 = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];

/** Cube-rooted cone responses to OKLab (Ottosson's M2). */
const LMS_TO_OKLAB: Matrix3 = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];

const OKLAB_TO_LMS = invert(LMS_TO_OKLAB);
const LMS_TO_LINEAR_SRGB = invert(LINEAR_SRGB_TO_LMS);

/** Writes the OKLab coordinates of a linear sRGB color into out[0..2], allocating nothing. */
function linearToOkLab(r: number, g: number, b: number, out: Float64Array): void {
  transform(LINEAR_SRGB_TO_LMS, r, g, b, out);
  // The cube root models the eye's compressed response to light.
  transform(LMS_TO_OKLAB, Math.cbrt(out[0]), Math.cbrt(out[1]), Math.cbrt(out[2]), out);
}

/**
 * A color in OKLab (Björn Ottosson, 2020), a perceptual space: l is lightness
 * from 0 (black) to 1 (white), a runs from green to red and b from blue to
 * yellow. Equal distances look about equally different, which makes it the
 * space for k-means, gradients and comparing colors.
 *
 * Value Object: immutable and defined only by its coordinates.
 */
export class OkLab {
  /** Type-only brand that keeps the type nominal (see Srgb). */
  private declare readonly brand: never;

  readonly l: number;
  readonly a: number;
  readonly b: number;

  constructor(l: number, a: number, b: number) {
    this.l = l;
    this.a = a;
    this.b = b;
  }

  static fromLinear(color: LinearRgb): OkLab {
    const out = new Float64Array(3);
    linearToOkLab(color.r, color.g, color.b, out);
    return new OkLab(out[0], out[1], out[2]);
  }

  static fromSrgb(color: Srgb): OkLab {
    return OkLab.fromLinear(LinearRgb.fromSrgb(color));
  }

  /** The perceptual mean of an image's pixels: their OKLab coordinates averaged. */
  static average(image: RgbaImage): OkLab | undefined {
    const mean = meanOfPixels(image, (red, green, blue, out) =>
      linearToOkLab(byteToLinear(red), byteToLinear(green), byteToLinear(blue), out),
    );
    return mean && new OkLab(...mean);
  }

  /** The color t of the way to another in perceptually even steps (CSS's "in oklab"). */
  mix(other: OkLab, t: number): OkLab {
    return new OkLab(lerp(this.l, other.l, t), lerp(this.a, other.a, t), lerp(this.b, other.b, t));
  }

  toLinear(): LinearRgb {
    const out = new Float64Array(3);
    transform(OKLAB_TO_LMS, this.l, this.a, this.b, out);
    transform(LMS_TO_LINEAR_SRGB, out[0] ** 3, out[1] ** 3, out[2] ** 3, out);
    return new LinearRgb(out[0], out[1], out[2]);
  }

  toSrgb(): Srgb {
    return this.toLinear().toSrgb();
  }
}
