import { SeededRandom } from '@palette-atlas/color';
import { HnswIndex, SearchRecorder, type SearchStep, Vectors } from '@palette-atlas/hnsw';
import { colorSchemeDistance } from '@palette-atlas/vectorize';
import { describe, expect, it } from 'vitest';
import { SearchReplay } from './search-replay.ts';

const SEED = 4;
const POINTS = 1500;
const DIMENSIONS = 12;
/** A small M gives the little index several layers above the bottom one. */
const M = 6;
/** As the Atlas asks: more than the search keeps by default, so that the search keeps as many. */
const COUNT = 60;
const QUERIES = 10;

function randomVectors(random: SeededRandom, count: number): Vectors {
  return new Vectors(DIMENSIONS, Float32Array.from({ length: count * DIMENSIONS }, () => random.next()));
}

describe('SearchReplay', () => {
  const random = new SeededRandom(SEED);
  const index = HnswIndex.build(randomVectors(random, POINTS), { random: new SeededRandom(SEED), M, distance: colorSchemeDistance });
  const queries = randomVectors(random, QUERIES);
  const traced = Array.from({ length: QUERIES }, (_, query) => {
    const tracer = new SearchRecorder();
    const vector = queries.data.subarray(query * DIMENSIONS, (query + 1) * DIMENSIONS);
    const found = index.search(vector, COUNT, { tracer });
    return { steps: tracer.steps, found: found.map(({ id }) => id) };
  });

  it('replays a search from the top layer down, along the index’s own links, to the very paintings it found', () => {
    const { graph } = index;
    expect(graph.topLevel).toBeGreaterThan(1);
    for (const { steps, found } of traced) {
      const replay = SearchReplay.of(steps, steps.length);
      expect(replay.done).toBe(true);
      expect([...replay.layers.keys()]).toEqual(Array.from({ length: graph.topLevel + 1 }, (_, layer) => graph.topLevel - layer));
      const strays: string[] = [];
      for (const [level, work] of replay.layers) {
        for (const [from, to] of work.followed) if (!graph.neighbors(from, level).includes(to)) strays.push(`${from} → ${to} on ${level}`);
        for (const node of work.expanded) if (!work.measured.has(node)) strays.push(`${node} expanded unmeasured on ${level}`);
      }
      expect(strays).toEqual([]);
      expect(replay.nearest(COUNT)).toEqual(found);
      expect(replay.nearest(10, found[0])).toEqual(found.slice(1, 11));
      expect(replay.measured).toBe(new Set(steps.flatMap((step) => (step.kind === 'measure' ? [step.node] : []))).size);
    }
  });

  it('shows nothing before the first step, and never takes back work as the steps go on', () => {
    const { steps } = traced[0];
    const start = SearchReplay.of(steps, 0);
    expect([start.level, start.layers.size, start.measured, start.done]).toEqual([-1, 0, 0, false]);
    let before = start;
    for (let count = 1; count <= steps.length; count += 37) {
      const replay = SearchReplay.of(steps, count);
      expect(replay.level).toBeLessThanOrEqual(before.level < 0 ? Infinity : before.level);
      expect(replay.measured).toBeGreaterThanOrEqual(before.measured);
      before = replay;
    }
  });

  it('refuses a record whose steps come before any layer', () => {
    const steps: SearchStep[] = [{ kind: 'measure', node: 0, distance: 1 }];
    expect(() => SearchReplay.of(steps, 1)).toThrow();
  });
});
