import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RgbaImage } from '@palette-atlas/color';
import {
  type ChunkFiles,
  type Columns,
  chunkOf,
  columnsOf,
  PAINTING_FIELDS,
  type Painting,
  packStrips,
  recordAt,
  stripInRow,
} from '@palette-atlas/gallery';
import { STRIP_SEGMENTS } from '@palette-atlas/strip';
import { readImage, writePng } from './image-file.ts';

/** Paintings in an order, with their color strips. */
export interface StoredPaintings {
  readonly paintings: readonly Painting[];
  readonly strips: readonly RgbaImage[];
}

/**
 * Writes paintings and their strips in chunks of `chunkSize` (see ChunkFiles), emptying the
 * chunks' folders first so that nothing of an earlier build stays.
 */
export async function writeChunks(folder: string, files: ChunkFiles, { paintings, strips }: StoredPaintings, chunkSize: number): Promise<void> {
  for (const subfolder of files.folders.map((name) => join(folder, name))) {
    await rm(subfolder, { recursive: true, force: true });
    await mkdir(subfolder, { recursive: true });
  }
  for (const [chunk, image] of packStrips(strips, STRIP_SEGMENTS, chunkSize).entries()) {
    const records = paintings.slice(chunk * chunkSize, (chunk + 1) * chunkSize);
    await writeFile(join(folder, files.paintings(chunk)), JSON.stringify(columnsOf(records, PAINTING_FIELDS)));
    // Every strip is opaque, so the alpha channel would only take room.
    await writePng(join(folder, files.strips(chunk)), image, { opaque: true });
  }
}

/** Reads back the first `count` paintings stored in chunks of `chunkSize` (see ChunkFiles), with their strips. */
export async function readChunks(folder: string, files: ChunkFiles, count: number, chunkSize: number): Promise<StoredPaintings> {
  const chunks = count > 0 ? chunkOf(count - 1, chunkSize).chunk + 1 : 0;
  const paintings: Painting[] = [];
  const strips: RgbaImage[] = [];
  for (let chunk = 0; chunk < chunks; chunk++) {
    const records = JSON.parse(await readFile(join(folder, files.paintings(chunk)), 'utf8')) as Columns<Painting>;
    const image = await readImage(join(folder, files.strips(chunk)));
    for (let row = 0; row < image.height && paintings.length < count; row++) {
      paintings.push(recordAt(records, row));
      strips.push(stripInRow(image, row));
    }
  }
  return { paintings, strips };
}
