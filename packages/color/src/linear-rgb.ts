import { Srgb } from './srgb.ts';

// The sRGB transfer curve (IEC 61966-2-1): a straight segment near black, then a power curve.

/** Encoded values up to this one lie on the straight segment. */
const ENCODED_BREAKPOINT = 0.04045;
/** Linear values up to this one lie on the straight segment. */
const LINEAR_BREAKPOINT = 0.0031308;
/** The slope of the straight segment. */
const LINEAR_SLOPE = 12.92;
/** The exponent of the power segment. */
const GAMMA = 2.4;
/** The offset that makes the power segment meet the straight one. */
const OFFSET = 0.055;

function decode(encoded: number): number {
  return encoded <= ENCODED_BREAKPOINT
    ? encoded / LINEAR_SLOPE
    : ((encoded + OFFSET) / (1 + OFFSET)) ** GAMMA;
}

function encode(linear: number): number {
  return linear <= LINEAR_BREAKPOINT
    ? linear * LINEAR_SLOPE
    : (1 + OFFSET) * linear ** (1 / GAMMA) - OFFSET;
}

/**
 * A color in linear-light RGB: the sRGB primaries without the gamma curve, so
 * each channel is proportional to light intensity. Physically correct mixing
 * and averaging happen here; doing them on gamma-encoded sRGB darkens colors.
 *
 * Value Object: immutable and defined only by its channels.
 */
export class LinearRgb {
  /** Type-only brand that keeps an Srgb from passing as a LinearRgb (see Srgb). */
  private declare readonly brand: never;

  readonly r: number;
  readonly g: number;
  readonly b: number;

  constructor(r: number, g: number, b: number) {
    this.r = r;
    this.g = g;
    this.b = b;
  }

  /** Removes the gamma curve from an sRGB color. */
  static fromSrgb(color: Srgb): LinearRgb {
    return new LinearRgb(decode(color.r), decode(color.g), decode(color.b));
  }

  /** Applies the gamma curve, giving the sRGB color a screen shows. */
  toSrgb(): Srgb {
    return new Srgb(encode(this.r), encode(this.g), encode(this.b));
  }
}
