import type { Found } from './layer-search.ts';

/** How far apart two stored nodes are. */
export type NodeDistance = (first: number, second: number) => number;

/**
 * Picks up to `count` links for a node from candidates found near it, nearest first: the paper's
 * SELECT-NEIGHBORS-HEURISTIC (Malkov and Yashunin, 2018, Algorithm 4), as hnswlib runs it, without
 * extending the candidates or keeping the pruned ones. A candidate is kept only if it lies nearer
 * the node than any link kept so far: one that a kept link already leads to is left out, so the
 * links point in different directions. Between two clusters, that keeps the link that bridges
 * them, where the nearest neighbors alone would all lie in the node's own cluster. The links it
 * keeps are those of the relative neighborhood graph among the candidates.
 */
export function selectNeighbors(candidates: Found, count: number, distanceBetween: NodeDistance): number[] {
  const kept: number[] = [];
  const { ids, distances } = candidates;
  for (let index = 0; index < ids.length && kept.length < count; index++) {
    const candidate = ids[index];
    const leadsThere = kept.some((link) => distanceBetween(link, candidate) < distances[index]);
    if (!leadsThere) kept.push(candidate);
  }
  return kept;
}
