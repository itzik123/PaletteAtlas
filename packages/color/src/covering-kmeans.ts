import { type Cluster, type Clusterer, DIMENSIONS, type KMeans, squaredDistance, type WeightedPoints } from './kmeans.ts';
import type { Vector3 } from './matrix3.ts';
import { drawIndex, type Random } from './random.ts';

/** How closely clusters must cover their points. */
export interface Coverage {
  /** How far a point may lie from the nearest centroid and still count as covered. */
  readonly distance: number;
  /** The share of the points' total weight that may lie uncovered. */
  readonly uncoveredShare: number;
  /** The most clusters to grow to, covered or not. */
  readonly maxClusters: number;
}

/**
 * k-means that adds clusters while too much of the points' weight lies far from every centroid.
 * k-means minimizes the sum of squared distances, so it folds a small group of distinct points
 * into a large cluster nearby: it costs that sum little, but leaves a color no palette color comes
 * near (Lin and Hanrahan, 2013, found that people pick exactly such accents for a color theme).
 * Each new centroid is drawn among the uncovered points by weight × squared distance, as k-means++
 * draws its seeds, and Lloyd iterations then settle all the clusters again.
 *
 * Decorator: a Clusterer that wraps KMeans, and returns its clusters as they are when they
 * already cover the points.
 */
export class CoveringKMeans implements Clusterer {
  readonly #kmeans: KMeans;
  readonly #random: Random;
  readonly #coverage: Coverage;

  constructor(kmeans: KMeans, random: Random, coverage: Coverage) {
    this.#kmeans = kmeans;
    this.#random = random;
    this.#coverage = coverage;
  }

  cluster(points: WeightedPoints): Cluster[] {
    let clusters = this.#kmeans.cluster(points);
    // Lloyd iterations never add clusters, so each round grows the count by one at most.
    for (let count = clusters.length; count < this.#coverage.maxClusters; count++) {
      const seed = this.#uncoveredSeed(points, clusters);
      if (!seed) break;
      clusters = this.#kmeans.refine(points, [...clusters.map(({ centroid }) => centroid), seed]);
    }
    return clusters;
  }

  /** A point to seed a new cluster at, drawn among the uncovered ones, or undefined if few enough are. */
  #uncoveredSeed({ coordinates, weights }: WeightedPoints, clusters: readonly Cluster[]): Vector3 | undefined {
    const centroids = Float64Array.from(clusters.flatMap(({ centroid }) => centroid));
    const coveredWithin = this.#coverage.distance ** 2;
    const chances = new Float64Array(weights.length);
    let uncovered = 0;
    let total = 0;
    for (let point = 0; point < weights.length; point++) {
      total += weights[point];
      let nearest = Number.POSITIVE_INFINITY;
      for (let cluster = 0; cluster < clusters.length; cluster++) {
        nearest = Math.min(nearest, squaredDistance(coordinates, point * DIMENSIONS, centroids, cluster * DIMENSIONS));
      }
      if (nearest <= coveredWithin) continue;
      uncovered += weights[point];
      chances[point] = weights[point] * nearest;
    }
    if (uncovered <= this.#coverage.uncoveredShare * total) return undefined;
    const offset = drawIndex(chances, this.#random) * DIMENSIONS;
    return [coordinates[offset], coordinates[offset + 1], coordinates[offset + 2]];
  }
}
