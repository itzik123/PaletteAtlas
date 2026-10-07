import { SeededRandom } from '@palette-atlas/color';
import { describe, expect, it } from 'vitest';
import { HnswIndex, type SearchStep, SearchRecorder, squaredEuclidean, Vectors } from './index.ts';

const SEED = 7;
const K = 10;
const QUERIES = 50;

function randomVectors(count: number, dimensions: number, random: SeededRandom): Vectors {
  return new Vectors(dimensions, Float32Array.from({ length: count * dimensions }, () => random.next()));
}

/** What a search did on one layer, as its record tells it. */
interface LayerRecord {
  readonly level: number;
  /** Each node measured, with its distance to the query, in the order measured. */
  readonly measured: { readonly node: number; readonly distance: number }[];
  /** The nodes whose links were followed, in order. */
  readonly expanded: number[];
  /** The nearest nodes found on the layer when the search left it. */
  readonly kept: Set<number>;
}

/** Replays a record step by step, as the Lab will. */
function replay(steps: readonly SearchStep[]): LayerRecord[] {
  const layers: LayerRecord[] = [];
  for (const step of steps) {
    if (step.kind === 'layer') {
      layers.push({ level: step.level, measured: [], expanded: [], kept: new Set() });
      continue;
    }
    const layer = layers[layers.length - 1];
    if (step.kind === 'measure') layer.measured.push({ node: step.node, distance: step.distance });
    else if (step.kind === 'expand') layer.expanded.push(step.node);
    else if (step.kind === 'keep') layer.kept.add(step.node);
    else layer.kept.delete(step.node);
  }
  return layers;
}

describe('SearchRecorder', () => {
  const random = new SeededRandom(SEED);
  const vectors = randomVectors(2000, 4, random);
  const queries = randomVectors(QUERIES, 4, random);
  const index = HnswIndex.build(vectors, { random: new SeededRandom(SEED), M: 8 });

  it('records a search so that replaying it gives the search’s answer, which recording leaves unchanged', () => {
    for (let query = 0; query < queries.count; query++) {
      const recorder = new SearchRecorder();
      const found = index.search(queries.vector(query), K, { tracer: recorder });
      expect(found).toEqual(index.search(queries.vector(query), K));

      const bottom = replay(recorder.steps).at(-1);
      const distances = new Map(bottom?.measured.map(({ node, distance }) => [node, distance]));
      const answer = [...(bottom?.kept ?? [])]
        .map((id) => ({ id, distance: distances.get(id) }))
        .sort((first, second) => (first.distance ?? 0) - (second.distance ?? 0) || first.id - second.id)
        .slice(0, K);
      expect(answer).toEqual(found);
    }
  });

  it('records a walk down from the top layer along the graph’s links, measuring true distances', () => {
    const { graph } = index;
    for (let query = 0; query < queries.count; query++) {
      const point = queries.vector(query);
      const recorder = new SearchRecorder();
      index.search(point, K, { tracer: recorder });
      const layers = replay(recorder.steps);
      expect(layers.map(({ level }) => level)).toEqual(Array.from({ length: graph.topLevel + 1 }, (_, index) => graph.topLevel - index));

      let entry = graph.entryPoint;
      const strays: string[] = [];
      for (const { level, measured, expanded, kept } of layers) {
        // Each layer starts where the one above ended; every other node measured is a link of one expanded.
        const reachable = new Set([entry, ...expanded.flatMap((node) => graph.neighbors(node, level))]);
        for (const { node, distance } of measured) {
          if (!reachable.has(node)) strays.push(`layer ${level}: node ${node} measured, but no link leads there`);
          if (distance !== squaredEuclidean(point, 0, vectors.data, node * vectors.dimensions, vectors.dimensions)) {
            strays.push(`layer ${level}: node ${node} measured wrong`);
          }
        }
        const seen = new Set(measured.map(({ node }) => node));
        if (expanded.some((node) => !seen.has(node))) strays.push(`layer ${level}: a node expanded before it was measured`);
        if ([...kept].some((node) => !seen.has(node))) strays.push(`layer ${level}: a node kept but never measured`);
        if (level > 0) {
          expect(kept.size).toBe(1);
          [entry] = kept;
        }
      }
      expect(strays).toEqual([]);
    }
  });
});
