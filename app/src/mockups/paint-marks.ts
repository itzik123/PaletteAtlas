import { BYTES_PER_PIXEL, Channel, linearToByte, MAX_BYTE } from '@palette-atlas/color';
import { CHANNELS } from './bar-fills.ts';
import type { Mark } from './barcode-design.ts';

/**
 * Paints a barcode's marks into an image `scale` times their size in CSS pixels (the screen's
 * pixels per CSS pixel). Each pixel holds the light of the colors over it in proportion to the
 * area they cover: area averaging in linear light, as the libraries shrink images. A bar thinner
 * than a pixel blends into it rather than vanish, and neighbors meet without a seam.
 */
export function paintMarks(
  marks: readonly Mark[],
  colorsOf: (painting: number) => Float64Array,
  width: number,
  height: number,
  scale: number,
): ImageData {
  const buffer = new LightBuffer(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
  for (const mark of marks) {
    const colors = colorsOf(mark.painting);
    if (colors.length > 0) paintMark(buffer, mark, colors, scale);
  }
  return buffer.toImageData();
}

/** Adds a mark to the buffer, its colors running along it, each pixel covered as far as the mark reaches over it. */
function paintMark(buffer: LightBuffer, mark: Mark, colors: Float64Array, scale: number): void {
  const left = mark.x * scale;
  const right = (mark.x + mark.width) * scale;
  const top = mark.y * scale;
  const bottom = (mark.y + mark.height) * scale;
  const upright = mark.direction === 'up';
  const line = upright ? lineColors(colors, top, bottom, true) : lineColors(colors, left, right, false);
  const lineStart = Math.floor(upright ? top : left);
  for (let y = Math.max(Math.floor(top), 0); y < Math.min(Math.ceil(bottom), buffer.height); y++) {
    const coveredY = Math.min(y + 1, bottom) - Math.max(y, top);
    for (let x = Math.max(Math.floor(left), 0); x < Math.min(Math.ceil(right), buffer.width); x++) {
      const coveredX = Math.min(x + 1, right) - Math.max(x, left);
      buffer.add(x, y, coveredX * coveredY, line, ((upright ? y : x) - lineStart) * CHANNELS);
    }
  }
}

/**
 * The colors a mark shows pixel by pixel along its length, which runs over the pixels from
 * `start` to `end` (fractional): for each pixel, the mean in linear light of the stretch of colors
 * it covers. Reversed, the colors run from `end` back to `start`, as up an upright bar, whose
 * pixel rows count down.
 */
function lineColors(colors: Float64Array, start: number, end: number, reversed: boolean): Float64Array {
  const count = colors.length / CHANNELS;
  const first = Math.floor(start);
  const pixels = Math.ceil(end) - first;
  const colorsPerPixel = count / (end - start);
  const line = new Float64Array(pixels * CHANNELS);
  for (let pixel = 0; pixel < pixels; pixel++) {
    // The stretch of the mark over this pixel, counted in colors from the mark's start.
    const from = (Math.max(first + pixel, start) - start) * colorsPerPixel;
    const to = (Math.min(first + pixel + 1, end) - start) * colorsPerPixel;
    if (reversed) addMean(colors, count - to, count - from, line, pixel * CHANNELS);
    else addMean(colors, from, to, line, pixel * CHANNELS);
  }
  return line;
}

/** Adds to `out` at `offset` the mean of the colors from `from` to `to`, counted in colors (fractional). */
function addMean(colors: Float64Array, from: number, to: number, out: Float64Array, offset: number): void {
  const length = to - from;
  if (length <= 0) return;
  const last = Math.min(Math.ceil(to), colors.length / CHANNELS);
  for (let color = Math.max(Math.floor(from), 0); color < last; color++) {
    const weight = (Math.min(color + 1, to) - Math.max(color, from)) / length;
    for (let channel = 0; channel < CHANNELS; channel++) out[offset + channel] += weight * colors[color * CHANNELS + channel];
  }
}

/**
 * An image being painted, each pixel gathering the light of the colors over it, weighted by the
 * area each covers, and the area covered in all.
 */
class LightBuffer {
  readonly width: number;
  readonly height: number;
  /** CHANNELS numbers per pixel, row by row from the top left. */
  readonly #light: Float64Array;
  readonly #coverage: Float64Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.#light = new Float64Array(width * height * CHANNELS);
    this.#coverage = new Float64Array(width * height);
  }

  /** Adds the color at colors[offset] over `area` of the pixel at (x, y). */
  add(x: number, y: number, area: number, colors: Float64Array, offset: number): void {
    const pixel = y * this.width + x;
    for (let channel = 0; channel < CHANNELS; channel++) this.#light[pixel * CHANNELS + channel] += area * colors[offset + channel];
    this.#coverage[pixel] += area;
  }

  /** The image: each pixel the mean of its colors, as opaque as it is covered, so the page shows through the rest. */
  toImageData(): ImageData {
    const image = new ImageData(this.width, this.height);
    this.#coverage.forEach((covered, pixel) => {
      if (covered === 0) return;
      const offset = pixel * BYTES_PER_PIXEL;
      for (let channel = 0; channel < CHANNELS; channel++) {
        image.data[offset + channel] = linearToByte(this.#light[pixel * CHANNELS + channel] / covered);
      }
      image.data[offset + Channel.alpha] = Math.round(Math.min(covered, 1) * MAX_BYTE);
    });
    return image;
  }
}
