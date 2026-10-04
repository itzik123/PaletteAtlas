import { lerp } from './lerp.ts';
import type { Vector3 } from './matrix3.ts';
import { meanOfPixels } from './pixel-mean.ts';
import { MAX_BYTE, type RgbaImage } from './rgba-image.ts';

/** CSS hex colors write each channel as two base-16 digits. */
const HEX_RADIX = 16;
const HEX_DIGITS_PER_CHANNEL = 2;

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

  /**
   * The naive mean of an image's pixels: their gamma-encoded values averaged as they are.
   * It comes out too dark (see LinearRgb.average) and is here to compare against.
   */
  static average(image: RgbaImage): Srgb | undefined {
    const mean = meanOfPixels(image, (red, green, blue, out) => {
      out[0] = red / MAX_BYTE;
      out[1] = green / MAX_BYTE;
      out[2] = blue / MAX_BYTE;
    });
    return mean && new Srgb(...mean);
  }

  /** The color t of the way to another, mixing gamma-encoded values (CSS's "in srgb"). */
  mix(other: Srgb, t: number): Srgb {
    return new Srgb(lerp(this.r, other.r, t), lerp(this.g, other.g, t), lerp(this.b, other.b, t));
  }

  /** 8-bit channels, rounded; colors outside the sRGB gamut are clipped to it. */
  toBytes(): Vector3 {
    return [toByte(this.r), toByte(this.g), toByte(this.b)];
  }

  /** The CSS hex notation, such as #ff8000. */
  toHex(): string {
    const digits = this.toBytes().map((byte) => byte.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_CHANNEL, '0'));
    return `#${digits.join('')}`;
  }
}

function toByte(channel: number): number {
  return Math.round(Math.min(Math.max(channel, 0), 1) * MAX_BYTE);
}
