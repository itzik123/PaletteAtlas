import { BYTES_PER_PIXEL, Channel, type PaletteColor, PalettePath, type RgbaImage } from '@palette-atlas/color';
import { SourceMap } from './source-map.ts';
import type { StripAxis } from './strip-axis.ts';

/** Finds the main colors of an image and the share of each, as extractPalette does. */
export type PaletteOf = (image: RgbaImage) => readonly PaletteColor[];

/**
 * Reads an image by color: its palette along the shortest path through the colors, darker end
 * first (see PalettePath), each color taking a stretch of the strip as long as its share of the
 * visible pixels. Within its stretch, a color's pixels run from the side of the color before it
 * to the side of the color after it, so that the strip flows from one color into the next.
 * Transparent pixels have no color, so they belong to no segment.
 *
 * The palette comes from an injected function (Strategy), so the caller picks its size and seed.
 */
export class ColorAxis implements StripAxis {
  readonly #paletteOf: PaletteOf;

  constructor(paletteOf: PaletteOf) {
    this.#paletteOf = paletteOf;
  }

  sourceMap(image: RgbaImage, segments: number): SourceMap {
    const path = new PalettePath(this.#paletteOf(image));
    const { width, height, data } = image;
    const positions = new Float64Array(width * height);
    const visible = new Uint32Array(width * height);
    let visibleCount = 0;
    for (let pixel = 0; pixel < width * height; pixel++) {
      const offset = pixel * BYTES_PER_PIXEL;
      if (data[offset + Channel.alpha] === 0) continue;
      positions[pixel] = path.position(data[offset + Channel.red], data[offset + Channel.green], data[offset + Channel.blue]);
      visible[visibleCount++] = pixel;
    }
    // Pixels at the same position, such as those of a flat area, keep their reading order.
    const sequence = visible.subarray(0, visibleCount).sort((a, b) => positions[a] - positions[b] || a - b);
    return SourceMap.fromSequence(width, height, sequence, segments);
  }
}
