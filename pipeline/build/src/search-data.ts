import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { type RgbaImage, SeededRandom } from '@palette-atlas/color';
import { GALLERY_FILES, MATCHES, NEAREST_COUNT, packNearest } from '@palette-atlas/gallery';
import { HnswIndex, Vectors } from '@palette-atlas/hnsw';
import { COLOR_SCHEME_LENGTH, colorSchemeDistance, colorSchemeVector } from '@palette-atlas/vectorize';
import { readGallery } from './chunk-files.ts';
import { landmarks } from './landmarks.ts';
import { type PaintingMapReport, writePaintingMap } from './map-data.ts';

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

/** What the search data hold: the index, each painting's nearest, and the map the Lab draws its layers on. */
export interface SearchDataReport {
  readonly paintings: number;
  /** The index file's size, gzipped. */
  readonly indexBytes: number;
  readonly map: PaintingMapReport;
}

/** Each painting's color scheme vector, from its color strip, in the strips' order. */
export function colorSchemeVectors(strips: readonly RgbaImage[]): Vectors {
  const data = new Float32Array(strips.length * COLOR_SCHEME_LENGTH);
  strips.forEach((strip, painting) => data.set(colorSchemeVector(strip), painting * COLOR_SCHEME_LENGTH));
  return new Vectors(COLOR_SCHEME_LENGTH, data);
}

/**
 * Writes the gallery's search index, each painting's nearest paintings (see writeNearest) and the
 * map (see writePaintingMap) from its color strips in gallery order, in chunks of `chunkSize` as
 * the gallery's, reading the strips' vectors once for all three.
 */
export async function writeSearchData(folder: string, strips: readonly RgbaImage[], chunkSize: number): Promise<SearchDataReport> {
  const vectors = colorSchemeVectors(strips);
  const bytes = buildSearchIndex(strips, vectors).toBytes();
  const gzipped = gzipSync(bytes, { level: GZIP_LEVEL });
  await writeFile(join(folder, GALLERY_FILES.searchIndex), gzipped);
  // Searched as the site reads it, its vectors a byte a number, so the nearest are those the site finds.
  await writeNearest(folder, HnswIndex.fromBytes(bytes, { distance: colorSchemeDistance }), vectors, chunkSize);
  return { paintings: strips.length, indexBytes: gzipped.length, map: await writePaintingMap(folder, strips, vectors) };
}

/**
 * The gallery's search index (see GALLERY_FILES.searchIndex): each painting's color scheme vector,
 * in an HNSW index whose node i is painting i and whose top layer holds the most typical painting
 * of each color family (see landmarks). The site's hosts serve a binary file as it is, so its file
 * is gzipped.
 */
function buildSearchIndex(strips: readonly RgbaImage[], vectors: Vectors): HnswIndex {
  return HnswIndex.build(vectors, {
    random: new SeededRandom(SEED),
    M,
    efConstruction: EF_CONSTRUCTION,
    distance: colorSchemeDistance,
    landmarks: landmarks(strips, vectors),
  });
}

/**
 * Writes each painting's NEAREST_COUNT nearest paintings, in chunks (see GALLERY_FILES.nearest):
 * the first the Atlas's search finds for its wall of matches, which asks for MATCHES + 1 and
 * leaves the painting itself out. About 2 ms a painting.
 */
async function writeNearest(folder: string, index: HnswIndex, vectors: Vectors, chunkSize: number): Promise<void> {
  const target = join(folder, GALLERY_FILES.nearest.folder);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  for (let start = 0; start < vectors.count; start += chunkSize) {
    const lists = Array.from({ length: Math.min(chunkSize, vectors.count - start) }, (_, row) =>
      index
        .search(vectors.vector(start + row), MATCHES + 1)
        .map(({ id }) => id)
        .filter((id) => id !== start + row)
        .slice(0, NEAREST_COUNT),
    );
    await writeFile(join(folder, GALLERY_FILES.nearest.chunk(start / chunkSize)), packNearest(lists));
  }
}

/**
 * Rebuilds the search index, the paintings' nearest and the map from the gallery's own files in a
 * folder, reading no image again: a few minutes, where pnpm paintings reads every painting's image
 * to write the gallery first.
 */
export async function buildSearchData(folder: string): Promise<SearchDataReport> {
  const { strips, manifest } = await readGallery(folder);
  return writeSearchData(folder, strips, manifest.chunkSize);
}

/** Reads the search index in a gallery's folder, as writeSearchData wrote it. */
export async function readSearchIndex(folder: string): Promise<HnswIndex> {
  return HnswIndex.fromBytes(gunzipSync(await readFile(join(folder, GALLERY_FILES.searchIndex))), { distance: colorSchemeDistance });
}
