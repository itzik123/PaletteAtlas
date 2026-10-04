import { BYTES_PER_PIXEL, type RgbaImage } from '@palette-atlas/color';

/** The square of pixels within radius of (x, y), clipped to the image, as an image of its own. */
export function regionAround(image: RgbaImage, x: number, y: number, radius: number): RgbaImage {
  const left = Math.max(0, x - radius);
  const top = Math.max(0, y - radius);
  const width = Math.min(image.width - 1, x + radius) - left + 1;
  const height = Math.min(image.height - 1, y + radius) - top + 1;
  const rowBytes = width * BYTES_PER_PIXEL;
  const data = new Uint8ClampedArray(height * rowBytes);
  for (let row = 0; row < height; row++) {
    const start = ((top + row) * image.width + left) * BYTES_PER_PIXEL;
    data.set(image.data.subarray(start, start + rowBytes), row * rowBytes);
  }
  return { width, height, data };
}
