import { SeededRandom } from '@palette-atlas/color';
import { describe, expect, it } from 'vitest';
import { BruteForceIndex, HnswIndex, type HnswGraph, Vectors } from './index.ts';

const SEED = 11;
const K = 10;
/** The share of the true nearest neighbors a search must find (the target in CLAUDE.md's Verification). */
const RECALL_TARGET = 0.95;

function randomVectors(count: number, dimensions: number, random: SeededRandom): Vectors {
  return new Vectors(dimensions, Float32Array.from({ length: count * dimensions }, () => random.next()));
}

/** Every node's level and its links on each of its layers, as sorted lists. */
function layout(graph: HnswGraph): number[][][] {
  return Array.from({ length: graph.count }, (_, node) =>
    Array.from({ length: graph.levelOf(node) + 1 }, (_, level) => graph.neighbors(node, level).sort((a, b) => a - b)),
  );
}

describe('HnswIndex.toBytes and HnswIndex.fromBytes', () => {
  const random = new SeededRandom(SEED);
  const vectors = randomVectors(3000, 8, random);
  const index = HnswIndex.build(vectors, { random: new SeededRandom(SEED), M: 8 });
  const bytes = index.toBytes();

  it('read the graph back as it was built, and write it again byte for byte', () => {
    const read = HnswIndex.fromBytes(bytes);
    expect(read.graph.entryPoint).toBe(index.graph.entryPoint);
    expect(read.graph.topLevel).toBe(index.graph.topLevel);
    expect(layout(read.graph)).toEqual(layout(index.graph));
    expect(read.toBytes()).toEqual(bytes);
  });

  it('keep each vector to within half a step of 255 across its dimension’s range', () => {
    const read = HnswIndex.fromBytes(bytes);
    let worst = 0;
    for (let dimension = 0; dimension < vectors.dimensions; dimension++) {
      const values = Array.from({ length: vectors.count }, (_, id) => vectors.data[id * vectors.dimensions + dimension]);
      const halfStep = (Math.max(...values) - Math.min(...values)) / 255 / 2;
      for (let id = 0; id < vectors.count; id++) {
        const at = id * vectors.dimensions + dimension;
        worst = Math.max(worst, Math.abs(read.vectors.data[at] - vectors.data[at]) / halfStep);
      }
    }
    expect(worst).toBeLessThanOrEqual(1 + 1e-4);
  });

  it('give an index that still finds 95% of the true nearest neighbors', () => {
    const read = HnswIndex.fromBytes(bytes);
    const queries = randomVectors(200, 8, random);
    const exact = new BruteForceIndex(vectors);
    let found = 0;
    for (let query = 0; query < queries.count; query++) {
      const truth = new Set(exact.search(queries.vector(query), K).map(({ id }) => id));
      found += read.search(queries.vector(query), K).filter(({ id }) => truth.has(id)).length;
    }
    expect(found / (queries.count * K)).toBeGreaterThanOrEqual(RECALL_TARGET);
  });

  it('refuse bytes that are not an index, or that end too soon', () => {
    const text = Uint8Array.from('not an index at all', (letter) => letter.charCodeAt(0));
    expect(() => HnswIndex.fromBytes(text)).toThrow(/not an HNSW index/);
    expect(() => HnswIndex.fromBytes(bytes.subarray(0, bytes.length - 1))).toThrow(RangeError);
    expect(() => HnswIndex.fromBytes(bytes.subarray(0, bytes.length / 2))).toThrow(RangeError);
  });

  it('save and read an empty index', () => {
    const empty = HnswIndex.build(new Vectors(3, new Float32Array(0)), { random: new SeededRandom(SEED) });
    expect(HnswIndex.fromBytes(empty.toBytes()).search(Float32Array.of(0, 0, 0), K)).toEqual([]);
  });
});
