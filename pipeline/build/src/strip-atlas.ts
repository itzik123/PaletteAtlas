import { BYTES_PER_PIXEL, type RgbaImage } from '@palette-atlas/color';
import type { AxisName } from '@palette-atlas/strip';
import type { AxisColors } from './strip-messages.ts';

/** One image of the atlas: the strips of a chunk of paintings along one axis. */
export interface AtlasImage {
  readonly axis: AxisName;
  readonly chunk: number;
  readonly image: RgbaImage;
}

/**
 * Many paintings' strips packed into images, which compress well as PNG and which the browser
 * decodes on its own: for each axis, one image per chunk of `chunkSize` paintings, with a row per
 * painting and a pixel per segment. Painting i is row i % chunkSize of chunk ⌊i / chunkSize⌋, so
 * a page loads only the chunks it shows. A strip with fewer segments than a row (a tall painting
 * has fewer columns than segments) fills the start of its row, and transparent pixels the rest.
 */
export class StripAtlas {
  readonly segments: number;
  readonly chunkSize: number;
  readonly #rows = new Map<AxisName, RgbaImage['data'][]>();

  constructor(segments: number, chunkSize: number) {
    this.segments = segments;
    this.chunkSize = chunkSize;
  }

  /** Adds the next painting's strips, one per axis. */
  add(strips: readonly AxisColors[]): void {
    for (const { axis, colors } of strips) {
      if (colors.width > this.segments || colors.height !== 1) {
        throw new RangeError(`Expected a strip of at most ${this.segments} × 1, got ${colors.width} × ${colors.height}`);
      }
      const row = new Uint8ClampedArray(this.segments * BYTES_PER_PIXEL);
      row.set(colors.data);
      const rows = this.#rows.get(axis) ?? [];
      rows.push(row);
      this.#rows.set(axis, rows);
    }
  }

  /** The atlas's images, axis by axis and chunk by chunk. */
  images(): AtlasImage[] {
    const images: AtlasImage[] = [];
    const rowBytes = this.segments * BYTES_PER_PIXEL;
    for (const [axis, rows] of this.#rows) {
      for (let chunk = 0; chunk * this.chunkSize < rows.length; chunk++) {
        const chunkRows = rows.slice(chunk * this.chunkSize, (chunk + 1) * this.chunkSize);
        const data = new Uint8ClampedArray(chunkRows.length * rowBytes);
        chunkRows.forEach((row, index) => data.set(row, index * rowBytes));
        images.push({ axis, chunk, image: { width: this.segments, height: chunkRows.length, data } });
      }
    }
    return images;
  }
}
