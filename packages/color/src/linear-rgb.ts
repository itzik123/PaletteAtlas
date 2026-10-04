import { lerp } from './lerp.ts';
import { meanOfPixels } from './pixel-mean.ts';
import { MAX_BYTE, type RgbaImage } from './rgba-image.ts';
import { Srgb, toByte } from './srgb.ts';

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

/** Linear light for every 8-bit value, so pixel loops look it up instead of computing a power. */
const BYTE_TO_LINEAR = Float64Array.from({ length: MAX_BYTE + 1 }, (_, byte) => decode(byte / MAX_BYTE));

/** Decodes an 8-bit sRGB channel to linear light. */
export function byteToLinear(byte: number): number {
  return BYTE_TO_LINEAR[byte];
}

/** Encodes linear light as an 8-bit sRGB channel. */
export function linearToByte(linear: number): number {
  return toByte(encode(linear));
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

  /**
   * The physically correct mean of an image's pixels: the color the image emits as a whole, as
   * if seen from so far away that its pixels blend.
   */
  static average(image: RgbaImage): LinearRgb | undefined {
    const mean = meanOfPixels(image, (red, green, blue, out) => {
      out[0] = BYTE_TO_LINEAR[red];
      out[1] = BYTE_TO_LINEAR[green];
      out[2] = BYTE_TO_LINEAR[blue];
    });
    return mean && new LinearRgb(...mean);
  }

  /** The color t of the way to another, mixing light intensities (CSS's "in srgb-linear"). */
  mix(other: LinearRgb, t: number): LinearRgb {
    return new LinearRgb(lerp(this.r, other.r, t), lerp(this.g, other.g, t), lerp(this.b, other.b, t));
  }

  /** Applies the gamma curve, giving the sRGB color a screen shows. */
  toSrgb(): Srgb {
    return new Srgb(encode(this.r), encode(this.g), encode(this.b));
  }
}
