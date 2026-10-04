import type { Vector3 } from './matrix3.ts';
import type { Random } from './random.ts';

/** Coordinates per point. */
export const DIMENSIONS = 3;

/** Weighted points in 3D, in typed arrays: point i is coordinates[3i..3i + 2], with weights[i]. */
export interface WeightedPoints {
  readonly coordinates: Float64Array;
  readonly weights: Float64Array;
}

/** A cluster's center and the total weight of its points. */
export interface Cluster {
  readonly centroid: Vector3;
  readonly weight: number;
}

/** Lloyd iterations allowed before stopping; palettes settle long before this. */
const DEFAULT_MAX_ITERATIONS = 100;
/** Candidates tried for each centroid after the first: this plus ln k, as in scikit-learn. */
const BASE_CANDIDATES = 2;

/**
 * k-means clustering of weighted 3D points. It seeds with greedy k-means++ (Arthur and
 * Vassilvitskii, 2007), drawing from the injected random source so that a fixed seed gives the
 * same clusters, then runs Lloyd iterations until no point changes cluster.
 */
export class KMeans {
  readonly #k: number;
  readonly #random: Random;
  readonly #maxIterations: number;

  constructor(k: number, random: Random, maxIterations = DEFAULT_MAX_ITERATIONS) {
    if (!Number.isInteger(k) || k < 1) throw new RangeError(`k must be a positive integer, not ${k}`);
    this.#k = k;
    this.#random = random;
    this.#maxIterations = maxIterations;
  }

  /** The non-empty clusters; fewer than k when the points sit at fewer than k distinct positions. */
  cluster(points: WeightedPoints): Cluster[] {
    const centroids = this.#seed(points);
    const assignments = new Int32Array(points.weights.length).fill(-1);
    let clusterWeights: Float64Array = new Float64Array(0);
    for (let iteration = 0; iteration < this.#maxIterations; iteration++) {
      if (!assign(points, centroids, assignments)) break;
      clusterWeights = moveCentroids(points, assignments, centroids);
    }
    return toClusters(centroids, clusterWeights);
  }

  /**
   * k-means++: the first centroid is a point drawn by weight, and each next one is drawn by
   * weight × squared distance to the nearest centroid so far, which spreads them out.
   */
  #seed(points: WeightedPoints): Float64Array {
    const { coordinates, weights } = points;
    const nearest = new Float64Array(weights.length).fill(Number.POSITIVE_INFINITY);
    const chances = Float64Array.from(weights);
    const candidates = BASE_CANDIDATES + Math.floor(Math.log(this.#k));
    const centroids: number[] = [];
    while (centroids.length < this.#k * DIMENSIONS) {
      const chosen = centroids.length === 0 ? this.#draw(chances) : this.#bestCandidate(points, nearest, chances, candidates);
      if (chosen < 0) break; // Every point already sits on a centroid.
      const offset = chosen * DIMENSIONS;
      centroids.push(...coordinates.subarray(offset, offset + DIMENSIONS));
      for (let point = 0; point < weights.length; point++) {
        nearest[point] = Math.min(nearest[point], squaredDistance(coordinates, point * DIMENSIONS, coordinates, offset));
        chances[point] = weights[point] * nearest[point];
      }
    }
    return Float64Array.from(centroids);
  }

  /**
   * The greedy step: draws a few candidates by their chances and keeps the one that leaves the
   * smallest weighted sum of squared distances, so a single unlucky draw can't spoil the seeding.
   */
  #bestCandidate(points: WeightedPoints, nearest: Float64Array, chances: Float64Array, candidates: number): number {
    const { coordinates, weights } = points;
    let best = -1;
    let bestPotential = Number.POSITIVE_INFINITY;
    for (let trial = 0; trial < candidates; trial++) {
      const candidate = this.#draw(chances);
      if (candidate < 0) return -1;
      let potential = 0;
      for (let point = 0; point < weights.length; point++) {
        const distance = squaredDistance(coordinates, point * DIMENSIONS, coordinates, candidate * DIMENSIONS);
        potential += weights[point] * Math.min(nearest[point], distance);
      }
      if (potential < bestPotential) {
        bestPotential = potential;
        best = candidate;
      }
    }
    return best;
  }

  /** A point index drawn with probability proportional to its chance, or -1 if every chance is zero. */
  #draw(chances: Float64Array): number {
    let total = 0;
    let lastPossible = -1;
    for (let index = 0; index < chances.length; index++) {
      total += chances[index];
      if (chances[index] > 0) lastPossible = index;
    }
    let remaining = this.#random.next() * total;
    for (let index = 0; index < chances.length; index++) {
      remaining -= chances[index];
      if (remaining < 0) return index;
    }
    return lastPossible; // Rounding can leave a sliver past the last point.
  }
}

/** Moves each point to its nearest centroid; true if any point changed cluster. */
function assign({ coordinates }: WeightedPoints, centroids: Float64Array, assignments: Int32Array): boolean {
  const k = centroids.length / DIMENSIONS;
  let changed = false;
  for (let point = 0; point < assignments.length; point++) {
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let cluster = 0; cluster < k; cluster++) {
      const distance = squaredDistance(coordinates, point * DIMENSIONS, centroids, cluster * DIMENSIONS);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = cluster;
      }
    }
    if (assignments[point] !== best) {
      assignments[point] = best;
      changed = true;
    }
  }
  return changed;
}

/**
 * Moves each centroid to the weighted mean of its points and returns each cluster's weight.
 * A centroid left without points stays where it is.
 */
function moveCentroids({ coordinates, weights }: WeightedPoints, assignments: Int32Array, centroids: Float64Array): Float64Array {
  const sums = new Float64Array(centroids.length);
  const clusterWeights = new Float64Array(centroids.length / DIMENSIONS);
  for (let point = 0; point < assignments.length; point++) {
    const cluster = assignments[point];
    clusterWeights[cluster] += weights[point];
    for (let axis = 0; axis < DIMENSIONS; axis++) {
      sums[cluster * DIMENSIONS + axis] += weights[point] * coordinates[point * DIMENSIONS + axis];
    }
  }
  clusterWeights.forEach((clusterWeight, cluster) => {
    if (clusterWeight === 0) return;
    for (let axis = 0; axis < DIMENSIONS; axis++) {
      centroids[cluster * DIMENSIONS + axis] = sums[cluster * DIMENSIONS + axis] / clusterWeight;
    }
  });
  return clusterWeights;
}

function toClusters(centroids: Float64Array, clusterWeights: Float64Array): Cluster[] {
  const clusters: Cluster[] = [];
  clusterWeights.forEach((weight, cluster) => {
    if (weight === 0) return;
    const offset = cluster * DIMENSIONS;
    clusters.push({ centroid: [centroids[offset], centroids[offset + 1], centroids[offset + 2]], weight });
  });
  return clusters;
}

function squaredDistance(a: Float64Array, aOffset: number, b: Float64Array, bOffset: number): number {
  const d0 = a[aOffset] - b[bOffset];
  const d1 = a[aOffset + 1] - b[bOffset + 1];
  const d2 = a[aOffset + 2] - b[bOffset + 2];
  return d0 * d0 + d1 * d1 + d2 * d2;
}
