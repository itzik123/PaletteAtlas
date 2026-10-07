import type { Distance } from './distance.ts';
import { LayeredGraph } from './layered-graph.ts';
import { LayerSearch } from './layer-search.ts';
import { selectNeighbors } from './neighbor-selection.ts';
import type { Random } from './random.ts';
import type { Vectors } from './vectors.ts';

/** The highest level a node can draw: the levels are stored as Uint8, and even M = 2 reaches 30 about once in a billion nodes. */
const MAX_LEVEL = 255;

/** The settings a graph is built with (see HnswOptions). */
export interface BuildSettings {
  readonly random: Random;
  readonly M: number;
  readonly efConstruction: number;
  readonly distance: Distance;
}

/**
 * Builds an HNSW graph by inserting the vectors one by one, in order: the paper's INSERT (Malkov
 * and Yashunin, 2018, Algorithm 1). Each node draws its level from an exponentially decaying
 * distribution, so that each layer holds about 1/M of the nodes of the one below, as in a skip
 * list. On each of its layers a node links to up to M of the nodes a search for it finds there,
 * and they link back to it; a node whose links are full keeps those the heuristic picks.
 */
export function buildGraph(vectors: Vectors, { random, M, efConstruction, distance }: BuildSettings): LayeredGraph {
  // The paper's m_L = 1 / ln(M): the share of nodes that reach a layer falls M-fold per layer.
  const levelFactor = 1 / Math.log(M);
  const levels = Uint8Array.from({ length: vectors.count }, () =>
    Math.min(MAX_LEVEL, Math.floor(-Math.log(1 - random.next()) * levelFactor)),
  );
  // The bottom layer allows twice as many links, which the paper finds close to optimal.
  const graph = new LayeredGraph(levels, M, 2 * M);
  const search = new LayerSearch(graph, vectors, distance);
  const { data, dimensions } = vectors;
  const distanceBetween = (first: number, second: number): number =>
    distance(data, first * dimensions, data, second * dimensions, dimensions);

  /** Links a node to a newcomer on a layer; if its links are full, the heuristic picks among them and the newcomer. */
  const linkBack = (node: number, level: number, newcomer: number): void => {
    if (graph.addNeighbor(node, level, newcomer)) return;
    const candidates = [...graph.neighbors(node, level), newcomer]
      .map((link) => ({ link, distance: distanceBetween(node, link) }))
      .sort((first, second) => first.distance - second.distance);
    const found = {
      ids: Int32Array.from(candidates, ({ link }) => link),
      distances: Float64Array.from(candidates, ({ distance }) => distance),
    };
    graph.setNeighbors(node, level, selectNeighbors(found, graph.maxNeighbors(level), distanceBetween));
  };

  for (let node = 0; node < vectors.count; node++) {
    const level = levels[node];
    const start = node * dimensions;
    if (graph.entryPoint < 0) {
      graph.entryPoint = node;
      graph.topLevel = level;
      continue;
    }
    // Above the node's own level, a greedy walk finds where to enter the layer below.
    let entry = graph.entryPoint;
    for (let layer = graph.topLevel; layer > level; layer--) entry = search.descend(data, start, entry, layer);
    // On each of the node's layers, the nodes found nearest it give its links, and the entry points below.
    let entries: ArrayLike<number> = [entry];
    for (let layer = Math.min(level, graph.topLevel); layer >= 0; layer--) {
      const found = search.search(data, start, entries, efConstruction, layer);
      const links = selectNeighbors(found, M, distanceBetween);
      graph.setNeighbors(node, layer, links);
      for (const link of links) linkBack(link, layer, node);
      entries = found.ids;
    }
    if (level > graph.topLevel) {
      graph.entryPoint = node;
      graph.topLevel = level;
    }
  }
  return graph;
}
