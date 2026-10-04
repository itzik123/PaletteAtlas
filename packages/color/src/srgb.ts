/** The largest value of an 8-bit channel. */
const MAX_BYTE = 255;

/**
 * A color in sRGB, the gamma-encoded space of screens and image files, with
 * channels in [0, 1]. The other color spaces convert from and to it.
 *
 * Value Object: immutable and defined only by its channels.
 */
export class Srgb {
  /**
   * Type-only brand. TypeScript compares classes by shape, so without it any
   * object with r, g and b (a LinearRgb included) would pass as an Srgb.
   */
  private declare readonly brand: never;

  readonly r: number;
  readonly g: number;
  readonly b: number;

  constructor(r: number, g: number, b: number) {
    this.r = r;
    this.g = g;
    this.b = b;
  }

  /** From 8-bit channels (0-255), the way images store them. */
  static fromBytes(r: number, g: number, b: number): Srgb {
    return new Srgb(r / MAX_BYTE, g / MAX_BYTE, b / MAX_BYTE);
  }
}
