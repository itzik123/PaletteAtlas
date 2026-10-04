import { byteToLinear, linearToByte } from './linear-rgb.ts';
import { BYTES_PER_PIXEL, Channel, MAX_BYTE, type RgbaImage } from './rgba-image.ts';

/** Red, green and blue: the sums kept for each bucket. */
const COLOR_CHANNELS = 3;

/**
 * The mean colors of many buckets of pixels at once, such as the segments of a strip: averaged
 * in linear light and weighted by opacity, with every running sum in typed arrays.
 * Accumulator: add pixels to buckets, then read all the means.
 */
export class BucketMeans {
  /** Linear-light red, green and blue per bucket, premultiplied by opacity. */
  readonly #sums: Float64Array;
  readonly #opacity: Float64Array;
  /** Pixels added per bucket, visible or not, which sets each bucket's coverage. */
  readonly #pixels: Float64Array;

  constructor(bucketCount: number) {
    this.#sums = new Float64Array(bucketCount * COLOR_CHANNELS);
    this.#opacity = new Float64Array(bucketCount);
    this.#pixels = new Float64Array(bucketCount);
  }

  /** Adds an 8-bit sRGB pixel to a bucket; its alpha (0-255) weights its color. */
  add(bucket: number, red: number, green: number, blue: number, alpha: number): void {
    this.#pixels[bucket]++;
    if (alpha === 0) return;
    const weight = alpha / MAX_BYTE;
    const offset = bucket * COLOR_CHANNELS;
    this.#sums[offset] += weight * byteToLinear(red);
    this.#sums[offset + 1] += weight * byteToLinear(green);
    this.#sums[offset + 2] += weight * byteToLinear(blue);
    this.#opacity[bucket] += weight;
  }

  /**
   * One pixel per bucket: its mean color as 8-bit sRGB, with the bucket's coverage as alpha.
   * A bucket with no visible pixel comes out transparent.
   */
  toImage(): RgbaImage {
    const bucketCount = this.#opacity.length;
    const data = new Uint8ClampedArray(bucketCount * BYTES_PER_PIXEL);
    for (let bucket = 0; bucket < bucketCount; bucket++) {
      const opacity = this.#opacity[bucket];
      if (opacity === 0) continue;
      const sum = bucket * COLOR_CHANNELS;
      const pixel = bucket * BYTES_PER_PIXEL;
      data[pixel + Channel.red] = linearToByte(this.#sums[sum] / opacity);
      data[pixel + Channel.green] = linearToByte(this.#sums[sum + 1] / opacity);
      data[pixel + Channel.blue] = linearToByte(this.#sums[sum + 2] / opacity);
      data[pixel + Channel.alpha] = Math.round((opacity / this.#pixels[bucket]) * MAX_BYTE);
    }
    return { width: bucketCount, height: 1, data };
  }
}
