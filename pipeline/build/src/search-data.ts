import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { type RgbaImage, SeededRandom } from '@palette-atlas/color';
import { GALLERY_FILES, type GalleryManifest } from '@palette-atlas/gallery';
import { HnswIndex, Vectors } from '@palette-atlas/hnsw';
import { COLOR_SCHEME_LENGTH, colorSchemeDistance, colorSchemeVector } from '@palette-atlas/vectorize';
import { readChunks } from './chunk-files.ts';
import { landmarks } from './landmarks.ts';

/** The seed the index's levels are drawn with, so that the same gallery always gives the same file. */
const SEED = 1;
/**
 * hnswlib's defaults. On the 48,695 paintings they build in under a minute, every painting finds
 * itself, and a search at ef = 32 finds all of the true 10 nearest (Oct 7, 2026).
 */
const M = 16;
const EF_CONSTRUCTION = 200;
/** gzip's best: the file is written once a release, and every visitor's first search downloads it. */
const GZIP_LEVEL = 9;

/** What the search index holds. */
export interface SearchIndexReport {
  readonly paintings: number;
  /** The file's size, gzipped. */
  readonly bytes: number;
}

/** Each painting's color scheme vector, from its color strip, in the strips' order. */
export function colorSchemeVectors(strips: readonly RgbaImage[]): Vectors {
  const data = new Float32Array(strips.length * COLOR_SCHEME_LENGTH);
  strips.forEach((strip, painting) => data.set(colorSchemeVector(strip), painting * COLOR_SCHEME_LENGTH));
  return new Vectors(COLOR_SCHEME_LENGTH, data);
}

/**
 * Writes the gallery's search index (see GALLERY_FILES.searchIndex) from its color strips in
 * gallery order: each painting's color scheme vector, in an HNSW index whose node i is painting i
 * and whose top layer holds the most typical painting of each color family (see landmarks),
 * gzipped, as the site's hosts serve a binary file as it is.
 */
export async function writeSearchIndex(folder: string, strips: readonly RgbaImage[]): Promise<SearchIndexReport> {
  const vectors = colorSchemeVectors(strips);
  const index = HnswIndex.build(vectors, {
    random: new SeededRandom(SEED),
    M,
    efConstruction: EF_CONSTRUCTION,
    distance: colorSchemeDistance,
    landmarks: landmarks(strips, vectors),
  });
  const bytes = gzipSync(index.toBytes(), { level: GZIP_LEVEL });
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

/** Reads the search index in a gallery's folder, as writeSearchIndex wrote it. */
export async function readSearchIndex(folder: string): Promise<HnswIndex> {
  return HnswIndex.fromBytes(gunzipSync(await readFile(join(folder, GALLERY_FILES.searchIndex))), { distance: colorSchemeDistance });
}
