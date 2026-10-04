import { describe, expect, it } from 'vitest';
import { SeededRandom } from './index.ts';
import { shortestPath } from './shortest-path.ts';

type Point = readonly [number, number, number];

const SEED = 11;
/** Brute force tries every order, so it stays small: 8 points already have 40,320. */
const MAX_BRUTE_FORCE_POINTS = 8;
const TRIALS_PER_SIZE = 5;
const LENGTH_DIGITS = 12;

function distance(p: Point, q: Point): number {
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

function pathLength(points: readonly Point[], order: readonly number[]): number {
  let length = 0;
  for (let step = 1; step < order.length; step++) length += distance(points[order[step - 1]], points[order[step]]);
  return length;
}

/** Every order of the given items. */
function* permutations(items: readonly number[]): Generator<number[]> {
  if (items.length <= 1) {
    yield [...items];
    return;
  }
  for (const [index, first] of items.entries()) {
    for (const rest of permutations(items.toSpliced(index, 1))) yield [first, ...rest];
  }
}

describe('shortestPath', () => {
  it('visits every point once, on a path as short as the best of every possible order', () => {
    const random = new SeededRandom(SEED);
    for (let count = 1; count <= MAX_BRUTE_FORCE_POINTS; count++) {
      const indices = Array.from({ length: count }, (_, index) => index);
      for (let trial = 0; trial < TRIALS_PER_SIZE; trial++) {
        const points = indices.map((): Point => [random.next(), random.next(), random.next()]);
        const order = shortestPath(count, (from, to) => distance(points[from], points[to]));
        let best = Number.POSITIVE_INFINITY;
        for (const candidate of permutations(indices)) best = Math.min(best, pathLength(points, candidate));
        expect(order.toSorted((a, b) => a - b)).toEqual(indices);
        expect(pathLength(points, order)).toBeCloseTo(best, LENGTH_DIGITS);
      }
    }
  });
});
