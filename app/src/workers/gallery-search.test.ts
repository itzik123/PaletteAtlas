import { BYTES_PER_PIXEL, MAX_BYTE, type RgbaImage, SeededRandom } from '@palette-atlas/color';
import { BruteForceIndex, HnswIndex, Vectors } from '@palette-atlas/hnsw';
import { STRIP_SEGMENTS } from '@palette-atlas/strip';
import { COLOR_SCHEME_LENGTH, colorSchemeDistance, colorSchemeVector } from '@palette-atlas/vectorize';
import { describe, expect, it } from 'vitest';
import { IndexLayers } from '../lab/index-layers.ts';
import { GallerySearch } from './gallery-search.ts';

const SEED = 9;
const PAINTINGS = 800;
/** A small M gives the little gallery several layers above the bottom one. */
const M = 6;
/** As the Atlas asks: more than the search keeps by default, so that the search keeps as many. */
const COUNT = 80;
const QUERIES = 12;

/** A color strip of a few bands of random colors, as a painting's might be. */
function randomStrip(random: SeededRandom): RgbaImage {
  const data = new Uint8ClampedArray(STRIP_SEGMENTS * BYTES_PER_PIXEL);
  const bands = 1 + Math.floor(random.next() * 4);
  for (let band = 0, segment = 0; band < bands; band++) {
    const color = [0, 1, 2].map(() => Math.floor(random.next() * (MAX_BYTE + 1)));
    const end = band === bands - 1 ? STRIP_SEGMENTS : segment + Math.floor(random.next() * (STRIP_SEGMENTS - segment));
    for (; segment < end; segment++) data.set([...color, MAX_BYTE], segment * BYTES_PER_PIXEL);
  }
  return { width: STRIP_SEGMENTS, height: 1, data };
}

describe('GallerySearch', () => {
  const random = new SeededRandom(SEED);
  const strips = Array.from({ length: PAINTINGS }, () => randomStrip(random));
  const data = new Float32Array(PAINTINGS * COLOR_SCHEME_LENGTH);
  strips.forEach((strip, painting) => data.set(colorSchemeVector(strip), painting * COLOR_SCHEME_LENGTH));
  const vectors = new Vectors(COLOR_SCHEME_LENGTH, data);
  const index = HnswIndex.build(vectors, { random: new SeededRandom(SEED), M, distance: colorSchemeDistance });
  const search = new GallerySearch(index);
  const queries = Array.from({ length: QUERIES }, () => randomStrip(random));

  it('records the very search the Atlas runs, from the top layer down, beside the exact answer', () => {
    const exact = new BruteForceIndex(vectors, colorSchemeDistance);
    for (const colors of queries) {
      const traced = search.traced(colors, COUNT);
      expect(traced.found).toEqual(search.nearest(colors, COUNT));
      expect(traced.vector).toEqual(colorSchemeVector(colors));
      expect(traced.exact).toEqual(exact.search(traced.vector, COUNT));
      // It enters each layer once, the top one first; and on the bottom one keeps all it answers with.
      const layers = traced.steps.flatMap((step) => (step.kind === 'layer' ? [step.level] : []));
      expect(layers).toEqual(Array.from({ length: index.graph.topLevel + 1 }, (_, layer) => index.graph.topLevel - layer));
      const kept = new Set<number>();
      for (const step of traced.steps.slice(traced.steps.findLastIndex((step) => step.kind === 'layer'))) {
        if (step.kind === 'keep') kept.add(step.node);
        if (step.kind === 'drop') kept.delete(step.node);
      }
      expect(traced.found.filter(({ id }) => !kept.has(id))).toEqual([]);
    }
  });

  it('hands over the layers above the bottom one, each painting on its own and linked as in the graph', () => {
    const { graph } = index;
    const layers = new IndexLayers(search.upperLayers());
    expect([layers.count, layers.topLevel, layers.entryPoint]).toEqual([graph.count, graph.topLevel, graph.entryPoint]);
    expect(graph.topLevel).toBeGreaterThan(1);
    const wrong: string[] = [];
    for (let level = 1; level <= graph.topLevel; level++) {
      const members = Array.from({ length: graph.count }, (_, node) => node).filter((node) => graph.levelOf(node) >= level);
      if (layers.nodesOn(level).join() !== members.join()) wrong.push(`layer ${level}'s paintings`);
      for (const node of members) if (layers.linksOf(node, level).join() !== graph.neighbors(node, level).join()) wrong.push(`${node}'s links on ${level}`);
    }
    for (let node = 0; node < graph.count; node++) if (layers.levelOf(node) !== graph.levelOf(node)) wrong.push(`${node}'s level`);
    expect(wrong).toEqual([]);
  });
});
