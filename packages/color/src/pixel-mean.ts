import type { Vector3 } from './matrix3.ts';
import { BYTES_PER_PIXEL, Channel, MAX_BYTE, type RgbaImage } from './rgba-image.ts';

/** Writes the coordinates of one 8-bit sRGB pixel, in some color space, into out[0..2]. */
export type PixelReader = (red: number, green: number, blue: number, out: Float64Array) => void;

/**
 * The alpha-weighted mean of an image's pixels in some color space, or undefined if no pixel is
 * visible. The reader converts each pixel into the space (Strategy, as a function), so every
 * space shares this loop, and nothing is allocated per pixel.
 */
export function meanOfPixels(image: RgbaImage, read: PixelReader): Vector3 | undefined {
  const { data } = image;
  const coordinates = new Float64Array(3);
  let sum0 = 0;
  let sum1 = 0;
  let sum2 = 0;
  let totalWeight = 0;
  for (let offset = 0; offset < data.length; offset += BYTES_PER_PIXEL) {
    const weight = data[offset + Channel.alpha] / MAX_BYTE;
    if (weight === 0) continue;
    read(data[offset + Channel.red], data[offset + Channel.green], data[offset + Channel.blue], coordinates);
    sum0 += weight * coordinates[0];
    sum1 += weight * coordinates[1];
    sum2 += weight * coordinates[2];
    totalWeight += weight;
  }
  if (totalWeight === 0) return undefined;
  return [sum0 / totalWeight, sum1 / totalWeight, sum2 / totalWeight];
}
