import { type Distance, squaredEuclidean } from './distance.ts';
import { buildGraph } from './hnsw-builder.ts';
import { readIndex, writeIndex } from './index-file.ts';
import type { HnswGraph, LayeredGraph } from './layered-graph.ts';
import { LayerSearch } from './layer-search.ts';
import type { Random } from './random.ts';
import { SILENT_TRACER, type SearchTracer } from './search-tracer.ts';
import { byDistance, type Neighbor, type VectorIndex } from './vector-index.ts';
import type { Vectors } from './vectors.ts';

/** hnswlib's default M; the paper finds 5 to 48 a reasonable range. */
const DEFAULT_M = 16;
/** hnswlib's default: enough that a build finds nearly all of a new node's nearest neighbors. */
const DEFAULT_EF_CONSTRUCTION = 200;
/** How many nodes a search keeps on the bottom layer, unless it asks for more. */
const DEFAULT_EF = 64;
/** The most links a node makes per layer: degrees are stored as Uint16, and the bottom layer holds 2M. */
const MAX_M = 1000;

export interface HnswOptions {
  /** Random numbers for the nodes' levels: a seeded source builds the same graph every time. */
  readonly random: Random;
  /** M, the links a node makes on each of its layers; it keeps up to 2M on the bottom one. */
  readonly M?: number;
  /** efConstruction, how many nodes a build's searches keep, to find each new node's links. */
  readonly efConstruction?: number;
  /** How far apart two vectors are: the squared Euclidean distance, unless another is given. */
  readonly distance?: Distance;
}

export interface ReadOptions {
  /** The distance the index was built with: the squared Euclidean distance, unless another is given. */
  readonly distance?: Distance;
}

export interface SearchOptions {
  /** ef, how many nodes the search keeps on the bottom layer: more finds more of the true nearest, more slowly. */
  readonly ef?: number;
  /** Hears each step of the search (see SearchRecorder); none is told, unless one is given. */
  readonly tracer?: SearchTracer;
}

/**
 * Hierarchical Navigable Small World graphs (Malkov and Yashunin, "Efficient and robust
 * approximate nearest neighbor search using Hierarchical Navigable Small World graphs", 2018): an
 * index that finds the vectors nearest a query by walking a graph in layers. The top layers hold
 * few nodes, linked across long distances; each layer down holds about M times more, linked more
 * closely, and the bottom layer holds every node. A search walks greedily down from the top layer,
 * then searches the bottom one best first (K-NN-SEARCH, Algorithm 5).
 */
export class HnswIndex implements VectorIndex {
  readonly #vectors: Vectors;
  readonly #graph: LayeredGraph;
  readonly #layerSearch: LayerSearch;

  private constructor(vectors: Vectors, graph: LayeredGraph, distance: Distance) {
    this.#vectors = vectors;
    this.#graph = graph;
    this.#layerSearch = new LayerSearch(graph, vectors, distance);
  }

  /** Indexes the vectors; the same vectors and the same random numbers build the same graph. */
  static build(
    vectors: Vectors,
    { random, M = DEFAULT_M, efConstruction = DEFAULT_EF_CONSTRUCTION, distance = squaredEuclidean }: HnswOptions,
  ): HnswIndex {
    if (!Number.isInteger(M) || M < 2 || M > MAX_M) throw new RangeError(`M must be an integer from 2 to ${MAX_M}, not ${M}`);
    if (!Number.isInteger(efConstruction) || efConstruction < 1) {
      throw new RangeError(`efConstruction must be a positive integer, not ${efConstruction}`);
    }
    return new HnswIndex(vectors, buildGraph(vectors, { random, M, efConstruction, distance }), distance);
  }

  /**
   * Reads an index that toBytes wrote. A file holds no distance, so the one the index was built
   * with must be given again. The vectors come back from a byte per number, each within half a
   * step of what it was (see QuantizedVectors).
   */
  static fromBytes(bytes: Uint8Array, { distance = squaredEuclidean }: ReadOptions = {}): HnswIndex {
    const { graph, vectors } = readIndex(bytes);
    return new HnswIndex(vectors, graph, distance);
  }

  /** The index as bytes, for a file (see writeIndex): its graph, and its vectors at a byte per number. */
  toBytes(): Uint8Array {
    return writeIndex(this.#graph, this.#vectors);
  }

  /** The vectors the index searches. */
  get vectors(): Vectors {
    return this.#vectors;
  }

  /** The graph, to read. */
  get graph(): HnswGraph {
    return this.#graph;
  }

  search(query: Float32Array, k: number, { ef = DEFAULT_EF, tracer = SILENT_TRACER }: SearchOptions = {}): Neighbor[] {
    const graph = this.#graph;
    if (graph.entryPoint < 0 || k < 1) return [];
    let entry = graph.entryPoint;
    for (let level = graph.topLevel; level > 0; level--) entry = this.#layerSearch.descend(query, 0, entry, level, tracer);
    const { ids, distances } = this.#layerSearch.search(query, 0, [entry], Math.max(ef, k), 0, tracer);
    return Array.from(ids, (id, index) => ({ id, distance: distances[index] }))
      .sort(byDistance)
      .slice(0, k);
  }
}
