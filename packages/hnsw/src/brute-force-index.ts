import { type Distance, squaredEuclidean } from './distance.ts';
import { DistanceHeap } from './distance-heap.ts';
import { byDistance, type Neighbor, type VectorIndex } from './vector-index.ts';
import type { Vectors } from './vectors.ts';

/**
 * Exact nearest neighbors, found by measuring the query's distance to every vector: the reference
 * an approximate index is checked against.
 */
export class BruteForceIndex implements VectorIndex {
  readonly #vectors: Vectors;
  readonly #distance: Distance;

  constructor(vectors: Vectors, distance: Distance = squaredEuclidean) {
    this.#vectors = vectors;
    this.#distance = distance;
  }

  search(query: Float32Array, k: number): Neighbor[] {
    if (k < 1) return [];
    const { data, dimensions, count } = this.#vectors;
    // The k nearest so far, the furthest of them on top, to make way for anything nearer.
    const nearest = new DistanceHeap('furthest');
    for (let id = 0; id < count; id++) {
      const distance = this.#distance(query, 0, data, id * dimensions, dimensions);
      if (nearest.size < k) nearest.push(id, distance);
      else if (distance < nearest.topDistance) {
        nearest.pop();
        nearest.push(id, distance);
      }
    }
    const found: Neighbor[] = [];
    for (; nearest.size > 0; nearest.pop()) found.push({ id: nearest.topId, distance: nearest.topDistance });
    return found.sort(byDistance);
  }
}
