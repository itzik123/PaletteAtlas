import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type RgbaImage, SeededRandom } from '@palette-atlas/color';
import { GALLERY_FILES, type GalleryManifest } from '@palette-atlas/gallery';
import { HnswIndex, Vectors } from '@palette-atlas/hnsw';
import { COLOR_SCHEME_LENGTH, colorSchemeDistance, colorSchemeVector } from '@palette-atlas/vectorize';
import { readChunks } from './chunk-files.ts';

/** The seed the index's levels are drawn with, so that the same gallery always gives the same file. */
const SEED = 1;
/**
 * hnswlib's defaults. On the 48,695 paintings they build in under a minute, every painting finds
 * itself, and a search at ef = 32 finds all of the true 10 nearest (Oct 7, 2026).
 */
const M = 16;
const EF_CONSTRUCTION = 200;

/** What the search index holds. */
export interface SearchIndexReport {
  readonly paintings: number;
  /** The file's size. */
  readonly bytes: number;
}

/**
 * Writes the gallery's search index (see GALLERY_FILES.searchIndex) from its color strips in
 * gallery order: each painting's color scheme vector, in an HNSW index whose node i is painting i.
 */
export async function writeSearchIndex(folder: string, strips: readonly RgbaImage[]): Promise<SearchIndexReport> {
  const data = new Float32Array(strips.length * COLOR_SCHEME_LENGTH);
  strips.forEach((strip, painting) => data.set(colorSchemeVector(strip), painting * COLOR_SCHEME_LENGTH));
  const index = HnswIndex.build(new Vectors(COLOR_SCHEME_LENGTH, data), {
    random: new SeededRandom(SEED),
    M,
    efConstruction: EF_CONSTRUCTION,
    distance: colorSchemeDistance,
  });
  const bytes = index.toBytes();
  await writeFile(join(folder, GALLERY_FILES.searchIndex), bytes);
  return { paintings: strips.length, bytes: bytes.length };
}

/**
 * Rebuilds the search index from the gallery's own files in a folder, reading no image again:
 * about a minute, where pnpm paintings reads every painting's image to write the gallery first.
 */
export async function buildSearchIndex(folder: string): Promise<SearchIndexReport> {
  const manifest = JSON.parse(await readFile(join(folder, GALLERY_FILES.manifest), 'utf8')) as GalleryManifest;
  const { strips } = await readChunks(folder, GALLERY_FILES.gallery, manifest.count, manifest.chunkSize);
  return writeSearchIndex(folder, strips);
}
