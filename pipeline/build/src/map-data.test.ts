import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RgbaImage } from '@palette-atlas/color';
import { GALLERY_FILES, type GalleryManifest, type PaintingMap } from '@palette-atlas/gallery';
import { BruteForceIndex, type Vectors } from '@palette-atlas/hnsw';
import { colorSchemeDistance } from '@palette-atlas/vectorize';
import { beforeAll, describe, expect, it } from 'vitest';
import { readChunks } from './chunk-files.ts';
import { averageColor, readPaintingMap } from './map-data.ts';
import { colorSchemeVectors } from './search-data.ts';

const DATA = join(import.meta.dirname, '../../../app/public/data');
/** A place on an axis is stored in 65,535 steps of the axis's range (see PaintingMap.toBytes). */
const PLACE_STEPS = 65_535;
/** The least share of the color schemes' variance the map must hold (92.5% on Oct 9, 2026). */
const HELD = 0.9;
/** Every this many paintings is a query for how close its nearest lie on the map. */
const QUERY_EVERY = 100;
const K = 10;
/** Every this many paintings stands for the whole gallery's distances. */
const SAMPLE_EVERY = 37;
/**
 * How far a painting's 10 nearest color schemes may lie from it on the map, on average, as a share
 * of how far the gallery lies from it: 6.7% on Oct 9, 2026, at worst 19% for a single painting.
 */
const NEAR_SHARE = 0.1;
/** Reading every strip and measuring every query's nearest take several seconds. */
const TIMEOUT_MS = 120_000;

describe('the gallery’s map', { timeout: TIMEOUT_MS }, () => {
  let strips: readonly RgbaImage[];
  let vectors: Vectors;
  let map: PaintingMap;

  beforeAll(async () => {
    const manifest = JSON.parse(await readFile(join(DATA, GALLERY_FILES.manifest), 'utf8')) as GalleryManifest;
    ({ strips } = await readChunks(DATA, GALLERY_FILES.gallery, manifest.count, manifest.chunkSize));
    vectors = colorSchemeVectors(strips);
    map = await readPaintingMap(DATA);
  }, TIMEOUT_MS);

  it('places every painting where its strip’s color scheme falls, in its strip’s average color', () => {
    expect(map.count).toBe(strips.length);
    const steps = [0, 1].map((axis) => {
      const values = Array.from({ length: map.count }, (_, painting) => map.places[painting * 2 + axis]);
      return (Math.max(...values) - Math.min(...values)) / PLACE_STEPS;
    });
    const misplaced: number[] = [];
    const miscolored: number[] = [];
    strips.forEach((strip, painting) => {
      const place = map.projection.place(vectors.vector(painting));
      if ([0, 1].some((axis) => Math.abs(place[axis] - map.places[painting * 2 + axis]) > steps[axis])) misplaced.push(painting);
      if (averageColor(strip).toSrgb().toBytes().some((channel, index) => channel !== map.colors[painting * 3 + index])) miscolored.push(painting);
    });
    expect(misplaced).toEqual([]);
    expect(miscolored).toEqual([]);
  });

  it('holds most of the color schemes’ variance, so each painting’s nearest lie close by on it', () => {
    expect(map.projection.held).toBeGreaterThanOrEqual(HELD);
    const { aspect } = map.projection;
    // Distances on the map across and down at one scale.
    const apart = (first: number, second: number): number =>
      Math.hypot(map.places[first * 2] - map.places[second * 2], (map.places[first * 2 + 1] - map.places[second * 2 + 1]) / aspect);
    const exact = new BruteForceIndex(vectors, colorSchemeDistance);
    let shares = 0;
    let queries = 0;
    for (let query = 0; query < vectors.count; query += QUERY_EVERY, queries++) {
      const nearest = exact
        .search(vectors.vector(query), K + 1)
        .map(({ id }) => id)
        .filter((id) => id !== query)
        .slice(0, K);
      let gallery = 0;
      let sampled = 0;
      for (let painting = 0; painting < vectors.count; painting += SAMPLE_EVERY, sampled++) gallery += apart(query, painting);
      shares += nearest.reduce((sum, id) => sum + apart(query, id), 0) / nearest.length / (gallery / sampled);
    }
    expect(shares / queries).toBeLessThan(NEAR_SHARE);
  });
});
