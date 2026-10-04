import { describe, expect, it } from 'vitest';
import { CoveringKMeans, KMeans, SeededRandom, type WeightedPoints } from './index.ts';

type Row = readonly [x: number, y: number, z: number, weight: number];

const SEED = 9;
const COVERAGE = { distance: 0.15, uncoveredShare: 0.005, maxClusters: 16 };

/** Weighted points from [x, y, z, weight] rows. */
function points(...rows: readonly Row[]): WeightedPoints {
  return {
    coordinates: Float64Array.from(rows.flatMap(([x, y, z]) => [x, y, z])),
    weights: Float64Array.from(rows.map(([, , , weight]) => weight)),
  };
}

function covering(k: number, coverage = COVERAGE): CoveringKMeans {
  const random = new SeededRandom(SEED);
  return new CoveringKMeans(new KMeans(k, random), random, coverage);
}

describe('CoveringKMeans', () => {
  it('adds a cluster for a group of points far from every centroid', () => {
    // Three heavy groups on a line, and a light one off to the side, which k-means alone folds
    // into the middle group: it costs the sum of squared distances little.
    const input = points([0, 0, 0, 40], [0.5, 0, 0, 30], [1, 0, 0, 28], [0.5, 0.3, 0, 2]);
    const kmeansOnly = new KMeans(3, new SeededRandom(SEED)).cluster(input);
    expect(kmeansOnly.map(({ centroid }) => centroid)).not.toContainEqual([0.5, 0.3, 0]);
    const clusters = covering(3).cluster(input);
    expect(clusters).toHaveLength(4);
    expect(clusters).toContainEqual({ centroid: [0.5, 0.3, 0], weight: 2 });
  });

  it('leaves clusters that already cover the points as k-means found them', () => {
    const input = points([0, 0, 0, 50], [0.05, 0, 0, 10], [1, 0, 0, 30], [1, 0.1, 0, 10]);
    expect(covering(2).cluster(input)).toEqual(new KMeans(2, new SeededRandom(SEED)).cluster(input));
  });

  it('grows to no more than its most clusters', () => {
    const input = points([0, 0, 0, 20], [1, 0, 0, 20], [0, 1, 0, 20], [0, 0, 1, 20], [1, 1, 1, 20]);
    expect(covering(2, { ...COVERAGE, maxClusters: 3 }).cluster(input)).toHaveLength(3);
  });
});
