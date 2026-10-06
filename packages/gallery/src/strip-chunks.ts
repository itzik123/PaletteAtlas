import { BYTES_PER_PIXEL, type RgbaImage } from '@palette-atlas/color';

/** Where a painting's data sits: in which chunk of the gallery, and at which row of it. */
export interface ChunkPosition {
  readonly chunk: number;
  readonly row: number;
}

/** The gallery is cut into chunks of chunkSize paintings, so a page loads only the ones it shows. */
export function chunkOf(position: number, chunkSize: number): ChunkPosition {
  return { chunk: Math.floor(position / chunkSize), row: position % chunkSize };
}

/**
 * Packs strips, all `segments` long, into images of up to chunkSize rows, a strip per row and a
 * pixel per segment: strip i is row chunkOf(i).row of image chunkOf(i).chunk. Many strips in one
 * image compress well as PNG, and the browser decodes them on its own.
 */
export function packStrips(strips: readonly RgbaImage[], segments: number, chunkSize: number): RgbaImage[] {
  const rowBytes = segments * BYTES_PER_PIXEL;
  const chunks: RgbaImage[] = [];
  for (let start = 0; start < strips.length; start += chunkSize) {
    const rows = strips.slice(start, start + chunkSize);
    const data = new Uint8ClampedArray(rows.length * rowBytes);
    rows.forEach(({ width, height, data: row }, index) => {
      if (width !== segments || height !== 1) throw new RangeError(`Expected a strip of ${segments} × 1, got ${width} × ${height}`);
      data.set(row, index * rowBytes);
    });
    chunks.push({ width: segments, height: rows.length, data });
  }
  return chunks;
}

/** The strip in a row of a chunk image. */
export function stripInRow(chunk: RgbaImage, row: number): RgbaImage {
  const rowBytes = chunk.width * BYTES_PER_PIXEL;
  return { width: chunk.width, height: 1, data: chunk.data.slice(row * rowBytes, (row + 1) * rowBytes) };
}
