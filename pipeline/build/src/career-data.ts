import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type Artist, careers, GALLERY_FILES, recordAt, recordCount } from '@palette-atlas/gallery';
import { readGallery, type StoredPaintings, writeChunks } from './chunk-files.ts';

/** What the careers hold. */
export interface CareersReport {
  /** The artists with a career: at least one painting dated closely enough to place. */
  readonly artists: number;
  /** The paintings placed in a career. */
  readonly paintings: number;
}

/**
 * Writes the artists' careers (see GALLERY_FILES.careers) from the gallery, its paintings in
 * gallery order with their strips: each artist's paintings that have a place in their career, in
 * the order they were made, artist after artist in the order of `artists`, and how many each has.
 */
export async function writeCareers(
  folder: string,
  { paintings, strips }: StoredPaintings,
  artists: readonly Artist[],
  chunkSize: number,
): Promise<CareersReport> {
  const lists = careers(paintings, artists);
  const order = lists.flat();
  await writeFile(join(folder, GALLERY_FILES.careerLengths), JSON.stringify(lists.map((career) => career.length)));
  const careerPaintings = { paintings: order.map((position) => paintings[position]), strips: order.map((position) => strips[position]) };
  await writeChunks(folder, GALLERY_FILES.careers, careerPaintings, chunkSize);
  return { artists: lists.filter((career) => career.length > 0).length, paintings: order.length };
}

/**
 * Rebuilds the careers from the gallery's own files in a folder, reading no image again: seconds,
 * where pnpm paintings reads every painting's image to write the gallery first.
 */
export async function buildCareers(folder: string): Promise<CareersReport> {
  const gallery = await readGallery(folder);
  const { artists, chunkSize } = gallery.manifest;
  return writeCareers(folder, gallery, Array.from({ length: recordCount(artists) }, (_, index) => recordAt(artists, index)), chunkSize);
}
