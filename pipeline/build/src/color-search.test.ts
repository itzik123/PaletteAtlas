import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { SeededRandom } from '@palette-atlas/color';
import { GALLERY_FILES, type GalleryManifest, stripInRow } from '@palette-atlas/gallery';
import { BruteForceIndex, HnswIndex, type VectorIndex, Vectors } from '@palette-atlas/hnsw';
import { COLOR_SCHEME_LENGTH, colorSchemeDistance, colorSchemeVector } from '@palette-atlas/vectorize';
import { beforeAll, describe, expect, it } from 'vitest';
import { readImage } from './image-file.ts';
import { readSearchIndex } from './search-data.ts';

const DATA = join(import.meta.dirname, '../../../app/public/data');
/** The gallery's first chunks of strips, as the pipeline wrote them: its 5,000 most famous paintings. */
const CHUNKS = 5;
const SEED = 1;
const K = 10;
/** Every this many paintings is a query. */
const QUERY_EVERY = 10;
/**
 * The most the gallery's search index may take to download, in bytes: every visitor's first search
 * waits for all of it.
 */
const DOWNLOAD_BUDGET = 6_000_000;
/** The share of the true nearest neighbors a search must find (the target in CLAUDE.md's Verification). */
const RECALL_TARGET = 0.95;
/**
 * Reading the strips and building the index take a few seconds, and so does each test's searching
 * every painting: more, beyond Vitest's 5 s default, while the rest of `pnpm test` runs alongside.
 */
const TIMEOUT_MS = 60_000;

describe('searching the gallery by color scheme', { timeout: TIMEOUT_MS }, () => {
  let vectors: Vectors;
  let index: HnswIndex;
  let exact: BruteForceIndex;

  beforeAll(async () => {
    const chunks = await Promise.all(Array.from({ length: CHUNKS }, (_, chunk) => readImage(join(DATA, GALLERY_FILES.gallery.strips(chunk)))));
    const strips = chunks.flatMap((chunk) => Array.from({ length: chunk.height }, (_, row) => stripInRow(chunk, row)));
    const data = new Float32Array(strips.length * COLOR_SCHEME_LENGTH);
    strips.forEach((strip, painting) => data.set(colorSchemeVector(strip), painting * COLOR_SCHEME_LENGTH));
    vectors = new Vectors(COLOR_SCHEME_LENGTH, data);
    index = HnswIndex.build(vectors, { random: new SeededRandom(SEED), distance: colorSchemeDistance });
    exact = new BruteForceIndex(vectors, colorSchemeDistance);
  }, TIMEOUT_MS);

  /** The share of the 10 paintings nearest by brute force, over the exact vectors, that the index finds. */
  function recall(searched: VectorIndex): number {
    let found = 0;
    let queries = 0;
    for (let query = 0; query < vectors.count; query += QUERY_EVERY, queries++) {
      const truth = new Set(exact.search(vectors.vector(query), K).map(({ id }) => id));
      found += searched.search(vectors.vector(query), K).filter(({ id }) => truth.has(id)).length;
    }
    return found / (queries * K);
  }

  it('finds with HNSW at least 95% of the 10 paintings nearest by brute force, and every painting itself', () => {
    expect(recall(index)).toBeGreaterThanOrEqual(RECALL_TARGET);
    // A painting can share its strip with a copy of itself, so the nearest is the painting or its twin.
    const lost = Array.from({ length: vectors.count }, (_, painting) => painting).filter(
      (painting) => index.search(vectors.vector(painting), 1)[0].distance !== 0,
    );
    expect(lost).toEqual([]);
  });

  it('still finds 95% of them once the index is saved, a byte per number, and read back', () => {
    const read = HnswIndex.fromBytes(index.toBytes(), { distance: colorSchemeDistance });
    expect(recall(read)).toBeGreaterThanOrEqual(RECALL_TARGET);
  });

  it('has the gallery’s own index hold every painting, each finding itself by its strip', async () => {
    const manifest = JSON.parse(await readFile(join(DATA, GALLERY_FILES.manifest), 'utf8')) as GalleryManifest;
    const site = await readSearchIndex(DATA);
    expect(site.graph.count).toBe(manifest.count);
    // A painting can share its strip with a copy of itself, and then its vector too.
    const sameVector = (first: number, second: number): boolean =>
      site.vectors.vector(first).every((value, dimension) => value === site.vectors.vector(second)[dimension]);
    const lost = Array.from({ length: vectors.count }, (_, painting) => painting).filter((painting) => {
      const [nearest] = site.search(vectors.vector(painting), 1);
      return nearest.id !== painting && !sameVector(nearest.id, painting);
    });
    expect(lost).toEqual([]);
  });

  it('keeps the gallery’s own index small enough to download for a first search', async () => {
    expect((await stat(join(DATA, GALLERY_FILES.searchIndex))).size).toBeLessThan(DOWNLOAD_BUDGET);
  });
});
