import { type Random, SeededRandom } from '@palette-atlas/color';
import { describe, expect, it } from 'vitest';
import { BruteForceIndex, HnswIndex, type Neighbor, type VectorIndex, Vectors } from './index.ts';

const SEED = 5;
/** The share of the true nearest neighbors a search must find (the target in CLAUDE.md's Verification). */
const RECALL_TARGET = 0.95;
const K = 10;
const QUERIES = 200;
/** Enough candidates to reach the target on data as hard as CLUSTERS below; the default is tuned on the paintings. */
const EF = 128;
/** Points spread in clusters, as color schemes gather around a few looks, which is harder than uniform noise. */
const CLUSTERS = 20;
const CLUSTER_SPREAD = 0.05;

/** A standard normal sample (Box-Muller). */
function gaussian(random: Random): number {
  return Math.sqrt(-2 * Math.log(1 - random.next())) * Math.cos(2 * Math.PI * random.next());
}

/** `count` points in the unit cube, gathered around CLUSTERS random centers. */
function clustered(count: number, dimensions: number, random: Random): Vectors {
  const centers = Array.from({ length: CLUSTERS }, () => Array.from({ length: dimensions }, () => random.next()));
  const data = new Float32Array(count * dimensions);
  for (let point = 0; point < count; point++) {
    const center = centers[Math.floor(random.next() * CLUSTERS)];
    for (let axis = 0; axis < dimensions; axis++) data[point * dimensions + axis] = center[axis] + gaussian(random) * CLUSTER_SPREAD;
  }
  return new Vectors(dimensions, data);
}

/** The share of each query's true k nearest neighbors that a search finds, over all queries. */
function recall(search: (query: Float32Array) => Neighbor[], exact: VectorIndex, queries: Vectors, k: number): number {
  let found = 0;
  for (let query = 0; query < queries.count; query++) {
    const truth = new Set(exact.search(queries.vector(query), k).map(({ id }) => id));
    found += search(queries.vector(query)).filter(({ id }) => truth.has(id)).length;
  }
  return found / (queries.count * k);
}

describe('HnswIndex', () => {
  // The Lab's plane mode searches points in 2D; the paintings' vectors have many more dimensions.
  it.each([{ dimensions: 2 }, { dimensions: 16 }])('finds 95 in 100 of the true 10 nearest neighbors in $dimensions dimensions', ({ dimensions }) => {
    const random = new SeededRandom(SEED);
    const vectors = clustered(3000, dimensions, random);
    const queries = clustered(QUERIES, dimensions, random);
    const index = HnswIndex.build(vectors, { random: new SeededRandom(SEED) });
    const found = recall((query) => index.search(query, K, { ef: EF }), new BruteForceIndex(vectors), queries, K);
    expect(found).toBeGreaterThanOrEqual(RECALL_TARGET);
  });

  it('finds every vector it holds as its own nearest neighbor', () => {
    const vectors = clustered(2000, 8, new SeededRandom(SEED));
    const index = HnswIndex.build(vectors, { random: new SeededRandom(SEED) });
    const lost: number[] = [];
    for (let id = 0; id < vectors.count; id++) {
      const [nearest] = index.search(vectors.vector(id), 1);
      if (nearest.id !== id || nearest.distance !== 0) lost.push(id);
    }
    expect(lost).toEqual([]);
  });

  it('builds the same graph from the same seed', () => {
    const vectors = clustered(1000, 8, new SeededRandom(SEED));
    const layers = (index: HnswIndex): number[][][] =>
      Array.from({ length: vectors.count }, (_, node) =>
        Array.from({ length: index.graph.levelOf(node) + 1 }, (_, level) => index.graph.neighbors(node, level)),
      );
    const first = HnswIndex.build(vectors, { random: new SeededRandom(SEED) });
    const second = HnswIndex.build(vectors, { random: new SeededRandom(SEED) });
    const other = HnswIndex.build(vectors, { random: new SeededRandom(SEED + 1) });
    expect(layers(second)).toEqual(layers(first));
    expect(layers(other)).not.toEqual(layers(first));
  });

  it('links each node only to other nodes of the same layer, within the layer’s limit', () => {
    const vectors = clustered(2000, 4, new SeededRandom(SEED));
    const { graph } = HnswIndex.build(vectors, { random: new SeededRandom(SEED), M: 6 });
    expect(graph.levelOf(graph.entryPoint)).toBe(graph.topLevel);
    expect(graph.topLevel).toBeGreaterThan(0);
    const broken: string[] = [];
    for (let node = 0; node < vectors.count; node++) {
      for (let level = 0; level <= graph.levelOf(node); level++) {
        const links = graph.neighbors(node, level);
        const fault =
          links.length > graph.maxNeighbors(level) ? 'too many links'
          : links.includes(node) ? 'a link to itself'
          : new Set(links).size < links.length ? 'a link twice'
          : links.some((other) => graph.levelOf(other) < level) ? 'a link to a node below the layer'
          : undefined;
        if (fault) broken.push(`node ${node}, layer ${level}: ${fault}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('puts the landmarks it is given alone on the top layer, the rest on their drawn layers below, and still finds 95 in 100', () => {
    const random = new SeededRandom(SEED);
    const vectors = clustered(3000, 16, random);
    const queries = clustered(QUERIES, 16, random);
    const landmarks = [7, 70, 700, 2900];
    const index = HnswIndex.build(vectors, { random: new SeededRandom(SEED), landmarks });
    const drawn = HnswIndex.build(vectors, { random: new SeededRandom(SEED) }).graph;
    const { graph } = index;
    const nodes = Array.from({ length: vectors.count }, (_, node) => node);
    expect(graph.topLevel).toBe(drawn.topLevel);
    expect(nodes.filter((node) => graph.levelOf(node) === graph.topLevel)).toEqual(landmarks);
    expect(landmarks).toContain(graph.entryPoint);
    const moved = nodes.filter((node) => !landmarks.includes(node) && graph.levelOf(node) !== Math.min(drawn.levelOf(node), graph.topLevel - 1));
    expect(moved).toEqual([]);
    expect(recall((query) => index.search(query, K, { ef: EF }), new BruteForceIndex(vectors), queries, K)).toBeGreaterThanOrEqual(RECALL_TARGET);
  });

  it('refuses landmarks it doesn’t hold', () => {
    const vectors = clustered(100, 2, new SeededRandom(SEED));
    for (const landmark of [-1, 100, 2.5]) {
      expect(() => HnswIndex.build(vectors, { random: new SeededRandom(SEED), landmarks: [3, landmark] })).toThrow(RangeError);
    }
  });

  it('answers with every vector it holds when asked for more, nearest first', () => {
    const vectors = clustered(50, 3, new SeededRandom(SEED));
    const query = vectors.vector(0);
    const found = HnswIndex.build(vectors, { random: new SeededRandom(SEED) }).search(query, 80);
    expect(found).toEqual(new BruteForceIndex(vectors).search(query, 80));
    expect(HnswIndex.build(new Vectors(3, new Float32Array(0)), { random: new SeededRandom(SEED) }).search(query, 5)).toEqual([]);
  });
});

describe('BruteForceIndex', () => {
  it('ranks every vector by its squared Euclidean distance to the query', () => {
    const vectors = new Vectors(2, Float32Array.of(0, 0, 3, 4, 1, 1, -2, 0));
    expect(new BruteForceIndex(vectors).search(Float32Array.of(0, 0), 3)).toEqual([
      { id: 0, distance: 0 },
      { id: 2, distance: 2 },
      { id: 3, distance: 4 },
    ]);
  });
});
