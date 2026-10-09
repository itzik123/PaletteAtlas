import type { Vector3 } from './matrix3.ts';
import { drawIndex, type Random } from './random.ts';

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

/** Groups weighted points into clusters. */
export interface Clusterer {
  /** The non-empty clusters of the points. */
  cluster(points: WeightedPoints): Cluster[];
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
export class KMeans implements Clusterer {
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
    return this.#lloyd(points, this.#seed(points));
  }

  /** Lloyd iterations from the given centroids, whatever their number: the non-empty clusters they settle into. */
  refine(points: WeightedPoints, centroids: readonly Vector3[]): Cluster[] {
    return this.#lloyd(points, Float64Array.from(centroids.flat()));
  }

  /** Moves the centroids, in place, until no point changes cluster. */
  #lloyd(points: WeightedPoints, centroids: Float64Array): Cluster[] {
    const assignments = new Assignments(points.weights.length, centroids.length / DIMENSIONS);
    let clusterWeights: Float64Array = new Float64Array(0);
    for (let iteration = 0; iteration < this.#maxIterations; iteration++) {
      if (!assignments.update(points, centroids)) break;
      const before = centroids.slice();
      clusterWeights = moveCentroids(points, assignments.clusters, centroids);
      assignments.moved(before, centroids);
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
      const chosen = centroids.length === 0 ? drawIndex(chances, this.#random) : this.#bestCandidate(points, nearest, chances, candidates);
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
      const candidate = drawIndex(chances, this.#random);
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
}

/**
 * How much nearer a point's own centroid must be than any other, by its bounds, to keep the point
 * without measuring: far more than the bounds' rounding errors (about 1e-15 in OKLrab's units), so
 * measuring every centroid would keep it too.
 */
const BOUND_SLACK = 1e-9;

/**
 * Each point's cluster, kept from one Lloyd iteration to the next with bounds on its distances
 * (Hamerly, "Making k-means even faster", 2010): an upper bound on the distance to its own
 * centroid and a lower bound on the distance to every other, each loosened by how far the
 * centroids have moved since. While the bounds keep the two apart, the point stays without a
 * centroid being measured; most points settle within a few iterations, so later ones measure few.
 * The bounds only skip what measuring every centroid would confirm, so the clusters come out
 * exactly the same, twice as fast on the gallery's paintings (Oct 9, 2026).
 */
class Assignments {
  /** Each point's cluster, or -1 before the first update. */
  readonly clusters: Int32Array;
  /** At least the distance from each point to its own centroid. */
  readonly #upper: Float64Array;
  /** At most the distance from each point to any other centroid. */
  readonly #lower: Float64Array;
  /** How far each centroid has moved since the last update. */
  readonly #shifts: Float64Array;
  /** The largest of those moves, the one after it, and whose the largest is. */
  #largest = { shift: 0, second: 0, cluster: -1 };

  constructor(count: number, k: number) {
    this.clusters = new Int32Array(count).fill(-1);
    this.#upper = new Float64Array(count);
    this.#lower = new Float64Array(count);
    this.#shifts = new Float64Array(k);
  }

  /** Moves each point to its nearest centroid; true if any point changed cluster. */
  update({ coordinates }: WeightedPoints, centroids: Float64Array): boolean {
    const { clusters } = this;
    const upper = this.#upper;
    const lower = this.#lower;
    const { shift: largest, second, cluster: farthest } = this.#largest;
    let changed = false;
    for (let point = 0; point < clusters.length; point++) {
      const own = clusters[point];
      const at = point * DIMENSIONS;
      if (own >= 0) {
        upper[point] += this.#shifts[own];
        lower[point] -= own === farthest ? second : largest;
        if (upper[point] + BOUND_SLACK < lower[point]) continue;
        // The bounds overlap: measured anew, the point's own centroid may still be clear of the rest.
        upper[point] = Math.sqrt(squaredDistance(coordinates, at, centroids, own * DIMENSIONS));
        if (upper[point] + BOUND_SLACK < lower[point]) continue;
      }
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      let secondDistance = Number.POSITIVE_INFINITY;
      for (let cluster = 0; cluster < this.#shifts.length; cluster++) {
        const distance = squaredDistance(coordinates, at, centroids, cluster * DIMENSIONS);
        if (distance < bestDistance) {
          secondDistance = bestDistance;
          bestDistance = distance;
          best = cluster;
        } else if (distance < secondDistance) {
          secondDistance = distance;
        }
      }
      upper[point] = Math.sqrt(bestDistance);
      lower[point] = Math.sqrt(secondDistance);
      if (own !== best) {
        clusters[point] = best;
        changed = true;
      }
    }
    return changed;
  }

  /** Notes how far each centroid moved, which widens every point's bounds at the next update. */
  moved(before: Float64Array, after: Float64Array): void {
    const largest = { shift: 0, second: 0, cluster: -1 };
    for (let cluster = 0; cluster < this.#shifts.length; cluster++) {
      const shift = Math.sqrt(squaredDistance(before, cluster * DIMENSIONS, after, cluster * DIMENSIONS));
      this.#shifts[cluster] = shift;
      if (shift > largest.shift) {
        largest.second = largest.shift;
        largest.shift = shift;
        largest.cluster = cluster;
      } else if (shift > largest.second) {
        largest.second = shift;
      }
    }
    this.#largest = largest;
  }
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
    const weight = weights[point];
    const at = point * DIMENSIONS;
    const sum = cluster * DIMENSIONS;
    clusterWeights[cluster] += weight;
    sums[sum] += weight * coordinates[at];
    sums[sum + 1] += weight * coordinates[at + 1];
    sums[sum + 2] += weight * coordinates[at + 2];
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

/** The squared distance between the point at aOffset in a and the one at bOffset in b. */
export function squaredDistance(a: Float64Array, aOffset: number, b: Float64Array, bOffset: number): number {
  const d0 = a[aOffset] - b[bOffset];
  const d1 = a[aOffset + 1] - b[bOffset + 1];
  const d2 = a[aOffset + 2] - b[bOffset + 2];
  return d0 * d0 + d1 * d1 + d2 * d2;
}
