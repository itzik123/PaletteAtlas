import type { UpperLayers } from '../workers/search-messages.ts';

/**
 * The search index's layers as the Lab draws them, from what the search worker hands over (see
 * UpperLayers): which paintings live on each layer, and how they link on every layer above the
 * bottom one. Every painting lives on the bottom layer, whose links stay in the worker.
 */
export class IndexLayers {
  readonly count: number;
  readonly entryPoint: number;
  readonly topLevel: number;
  readonly #levels: Uint8Array;
  readonly #layers: UpperLayers['layers'];
  /** Each layer's nodes in id order, layer 0 first, found on first use. */
  readonly #nodes: Int32Array[] = [];

  constructor({ count, entryPoint, topLevel, levels, layers }: UpperLayers) {
    this.count = count;
    this.entryPoint = entryPoint;
    this.topLevel = topLevel;
    this.#levels = levels;
    this.#layers = layers;
  }

  /** The highest layer a painting lives on. */
  levelOf(node: number): number {
    return this.#levels[node];
  }

  /** The paintings that live on a layer, in id order: every painting, on the bottom one. */
  nodesOn(level: number): Int32Array {
    if (!this.#nodes[level]) {
      const nodes: number[] = [];
      for (let node = 0; node < this.count; node++) if (this.#levels[node] >= level) nodes.push(node);
      this.#nodes[level] = Int32Array.from(nodes);
    }
    return this.#nodes[level];
  }

  /** A painting's links on a layer above the bottom one. */
  linksOf(node: number, level: number): Int32Array {
    const layer = this.#layers[level - 1];
    if (!layer || this.levelOf(node) < level) throw new RangeError(`Painting ${node} has no links on layer ${level} here`);
    const rank = lowerBound(this.nodesOn(level), node);
    return layer.links.subarray(layer.starts[rank], layer.starts[rank + 1]);
  }
}

/** Where a value is, or would go, in an ascending array. */
function lowerBound(values: Int32Array, value: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (values[middle] < value) low = middle + 1;
    else high = middle;
  }
  return low;
}
