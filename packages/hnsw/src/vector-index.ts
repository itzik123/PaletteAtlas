/** A vector an index found, and how far it lies from the query. */
export interface Neighbor {
  /** The vector's place among the indexed vectors. */
  readonly id: number;
  readonly distance: number;
}

/**
 * Finds the indexed vectors nearest a query.
 *
 * Liskov substitution: HnswIndex and BruteForceIndex answer alike, so a recall test swaps one for
 * the other.
 */
export interface VectorIndex {
  /** The k vectors nearest the query (all of them, if there are fewer), nearest first. */
  search(query: Float32Array, k: number): Neighbor[];
}

/** Orders neighbors nearest first, and those equally near by id, so that equal answers compare equal. */
export function byDistance(first: Neighbor, second: Neighbor): number {
  return first.distance - second.distance || first.id - second.id;
}
