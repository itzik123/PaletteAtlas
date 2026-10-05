import { BYTES_PER_PIXEL, type RgbaImage } from '@palette-atlas/color';
import type { AxisName } from '@palette-atlas/strip';
import { decodeImage } from '../image-adapters.ts';

/** What the check page reads of the pipeline's paintings file (see pipeline/build/src/painting-data.ts). */
export interface PaintingsFile {
  readonly segments: number;
  readonly axes: readonly AxisName[];
  readonly chunkSize: number;
  readonly artists: readonly { readonly name: string | null; readonly born: number | null; readonly died: number }[];
  readonly paintings: readonly Painting[];
}

export interface Painting {
  readonly id: string;
  readonly title: string | null;
  readonly artist: number;
  readonly year: number;
  readonly precision: string;
  readonly collection: string | null;
  readonly file: string;
  readonly license: string;
  readonly thumbnail: string;
  /** Its strips shorter than `segments`, by axis. */
  readonly lengths?: Partial<Record<AxisName, number>>;
}

/** Where the pipeline writes the app's data (app/public/data), as the page sees it. */
export const DATA_URL = './data/';

/**
 * The strips the pipeline stored in its atlas images: painting i along an axis is row
 * i % chunkSize of strips/<axis>-<⌊i / chunkSize⌋>.png, as long as Painting.lengths says. Each
 * image is fetched and decoded once.
 */
export class AtlasStrips {
  readonly #paintings: PaintingsFile;
  readonly #chunks = new Map<string, Promise<RgbaImage>>();

  constructor(paintings: PaintingsFile) {
    this.#paintings = paintings;
  }

  async strip(axis: AxisName, index: number): Promise<RgbaImage> {
    const { segments, chunkSize, paintings } = this.#paintings;
    const length = paintings[index].lengths?.[axis] ?? segments;
    const name = `${axis}-${Math.floor(index / chunkSize)}`;
    let chunk = this.#chunks.get(name);
    if (!chunk) {
      chunk = fetch(`${DATA_URL}strips/${name}.png`).then(async (response) => decodeImage(await response.blob()));
      this.#chunks.set(name, chunk);
    }
    const row = (index % chunkSize) * segments * BYTES_PER_PIXEL;
    return { width: length, height: 1, data: (await chunk).data.slice(row, row + length * BYTES_PER_PIXEL) };
  }
}
