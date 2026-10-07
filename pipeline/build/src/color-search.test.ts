import { join } from 'node:path';
import { SeededRandom } from '@palette-atlas/color';
import { GALLERY_FILES, stripInRow } from '@palette-atlas/gallery';
import { BruteForceIndex, HnswIndex, Vectors } from '@palette-atlas/hnsw';
import { COLOR_SCHEME_LENGTH, colorSchemeDistance, colorSchemeVector } from '@palette-atlas/vectorize';
import { describe, expect, it } from 'vitest';
import { readImage } from './image-file.ts';

const DATA = join(import.meta.dirname, '../../../app/public/data');
/** The gallery's first chunks of strips, as the pipeline wrote them: its 5,000 most famous paintings. */
const CHUNKS = 5;
const SEED = 1;
const K = 10;
/** Every this many paintings is a query. */
const QUERY_EVERY = 10;
/** The share of the true nearest neighbors a search must find (the target in CLAUDE.md's Verification). */
const RECALL_TARGET = 0.95;
/** Building the index takes a few seconds. */
const TIMEOUT_MS = 60_000;

describe('searching the gallery by color scheme', () => {
  it(
    'finds with HNSW at least 95% of the 10 paintings nearest by brute force, and every painting itself',
    async () => {
      const chunks = await Promise.all(Array.from({ length: CHUNKS }, (_, chunk) => readImage(join(DATA, GALLERY_FILES.gallery.strips(chunk)))));
      const strips = chunks.flatMap((chunk) => Array.from({ length: chunk.height }, (_, row) => stripInRow(chunk, row)));
      const data = new Float32Array(strips.length * COLOR_SCHEME_LENGTH);
      strips.forEach((strip, painting) => data.set(colorSchemeVector(strip), painting * COLOR_SCHEME_LENGTH));
      const vectors = new Vectors(COLOR_SCHEME_LENGTH, data);

      const index = HnswIndex.build(vectors, { random: new SeededRandom(SEED), distance: colorSchemeDistance });
      const exact = new BruteForceIndex(vectors, colorSchemeDistance);
      let found = 0;
      let queries = 0;
      for (let query = 0; query < vectors.count; query += QUERY_EVERY, queries++) {
        const truth = new Set(exact.search(vectors.vector(query), K).map(({ id }) => id));
        found += index.search(vectors.vector(query), K).filter(({ id }) => truth.has(id)).length;
      }
      expect(found / (queries * K)).toBeGreaterThanOrEqual(RECALL_TARGET);

      // A painting can share its strip with a copy of itself, so the nearest is the painting or its twin.
      const lost = Array.from({ length: vectors.count }, (_, painting) => painting).filter(
        (painting) => index.search(vectors.vector(painting), 1)[0].distance !== 0,
      );
      expect(lost).toEqual([]);
    },
    TIMEOUT_MS,
  );
});
