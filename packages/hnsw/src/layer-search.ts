import type { Distance } from './distance.ts';
import { DistanceHeap } from './distance-heap.ts';
import type { LayeredGraph } from './layered-graph.ts';
import { VisitedSet } from './visited-set.ts';
import type { Vectors } from './vectors.ts';

/** Nodes a layer search found, nearest first, with their distances to the query. */
export interface Found {
  readonly ids: Int32Array;
  readonly distances: Float64Array;
}

/**
 * Searches one layer of an HNSW graph for the nodes nearest a query: the paper's SEARCH-LAYER
 * (Malkov and Yashunin, 2018, Algorithm 2), and the greedy walk the search takes down the upper
 * layers. The query is any vector, given as an array and where it starts in it, so that a node
 * being inserted is searched for in place.
 *
 * It keeps its heaps and visited marks from one search to the next, so a search allocates little;
 * one search runs at a time.
 */
export class LayerSearch {
  readonly #graph: LayeredGraph;
  readonly #vectors: Vectors;
  readonly #distance: Distance;
  readonly #visited: VisitedSet;
  readonly #candidates = new DistanceHeap('nearest');
  readonly #results = new DistanceHeap('furthest');

  constructor(graph: LayeredGraph, vectors: Vectors, distance: Distance) {
    this.#graph = graph;
    this.#vectors = vectors;
    this.#distance = distance;
    this.#visited = new VisitedSet(vectors.count);
  }

  /** How far a stored node lies from the query. */
  distanceTo(query: Float32Array, queryStart: number, node: number): number {
    const { data, dimensions } = this.#vectors;
    return this.#distance(query, queryStart, data, node * dimensions, dimensions);
  }

  /**
   * Walks a layer greedily from a node: on to the nearest of its links as long as one is nearer
   * the query, and returns where the walk stops. This is SEARCH-LAYER with ef = 1, which the
   * search uses to come down the upper layers.
   */
  descend(query: Float32Array, queryStart: number, entry: number, level: number): number {
    const { links } = this.#graph;
    let current = entry;
    let nearest = this.distanceTo(query, queryStart, entry);
    for (let moved = true; moved; ) {
      moved = false;
      const start = this.#graph.linkStart(current, level);
      const end = start + this.#graph.degree(current, level);
      for (let link = start; link < end; link++) {
        const distance = this.distanceTo(query, queryStart, links[link]);
        if (distance < nearest) {
          nearest = distance;
          current = links[link];
          moved = true;
        }
      }
    }
    return current;
  }

  /**
   * The ef nodes nearest the query that a best-first walk of a layer finds from the entry points.
   * The walk always explores the nearest candidate not yet explored, and stops once that is
   * further than every one of the ef results so far: none of its links would be likely to improve
   * on them.
   */
  search(query: Float32Array, queryStart: number, entries: ArrayLike<number>, ef: number, level: number): Found {
    const visited = this.#visited;
    const candidates = this.#candidates;
    const results = this.#results;
    visited.clear();
    candidates.clear();
    results.clear();
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      if (!visited.visit(entry)) continue;
      const distance = this.distanceTo(query, queryStart, entry);
      candidates.push(entry, distance);
      results.push(entry, distance);
      if (results.size > ef) results.pop();
    }

    const { links } = this.#graph;
    while (candidates.size > 0) {
      const nearest = candidates.topId;
      if (candidates.topDistance > results.topDistance) break;
      candidates.pop();
      const start = this.#graph.linkStart(nearest, level);
      const end = start + this.#graph.degree(nearest, level);
      for (let link = start; link < end; link++) {
        const node = links[link];
        if (!visited.visit(node)) continue;
        const distance = this.distanceTo(query, queryStart, node);
        if (results.size < ef || distance < results.topDistance) {
          candidates.push(node, distance);
          results.push(node, distance);
          if (results.size > ef) results.pop();
        }
      }
    }
    return drain(results);
  }
}

/** Empties a heap of results, furthest on top, into a list nearest first. */
function drain(results: DistanceHeap): Found {
  const ids = new Int32Array(results.size);
  const distances = new Float64Array(results.size);
  for (let index = results.size - 1; index >= 0; index--) {
    ids[index] = results.topId;
    distances[index] = results.topDistance;
    results.pop();
  }
  return { ids, distances };
}
