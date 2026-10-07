/**
 * An HNSW graph as its readers see it (the Lab draws it): every node lives on the bottom layer, 0,
 * and on each layer up to its own level, linked on each layer to nodes of that layer.
 */
export interface HnswGraph {
  /** How many nodes the graph has: one per indexed vector, with the same ids. */
  readonly count: number;
  /** Where every search starts: a node on the top layer, or -1 in an empty graph. */
  readonly entryPoint: number;
  /** The highest layer, the entry point's level, or -1 in an empty graph. */
  readonly topLevel: number;
  /** The highest layer a node lives on. */
  levelOf(node: number): number;
  /** The most links a node can have on a layer. */
  maxNeighbors(level: number): number;
  /** A node's links on a layer, as a new array. */
  neighbors(node: number, level: number): number[];
}

/**
 * The layers of an HNSW graph in two typed arrays, laid out as hnswlib does: every node's links on
 * the bottom layer first, room for maxNeighbors0 each, then the links of the nodes with upper
 * layers, room for maxNeighbors on each of them. Its levels are fixed when it is made, so that all
 * the room it needs is allocated once.
 */
export class LayeredGraph implements HnswGraph {
  entryPoint = -1;
  topLevel = -1;
  readonly #levels: Uint8Array;
  readonly #maxNeighbors: number;
  readonly #maxNeighbors0: number;
  /** For each node, the index of its block on layer 1 among all upper blocks, or -1 if it has none. */
  readonly #upperBlocks: Int32Array;
  /** Every block's links, each block's first `degree` slots in use. */
  readonly links: Int32Array;
  /** How many links each block has: the bottom layer's blocks by node, then the upper blocks. */
  readonly #degrees: Uint16Array;

  constructor(levels: Uint8Array, maxNeighbors: number, maxNeighbors0: number) {
    this.#levels = levels;
    this.#maxNeighbors = maxNeighbors;
    this.#maxNeighbors0 = maxNeighbors0;
    this.#upperBlocks = new Int32Array(levels.length).fill(-1);
    let upperBlockCount = 0;
    levels.forEach((level, node) => {
      if (level > 0) this.#upperBlocks[node] = upperBlockCount;
      upperBlockCount += level;
    });
    this.links = new Int32Array(levels.length * maxNeighbors0 + upperBlockCount * maxNeighbors);
    this.#degrees = new Uint16Array(levels.length + upperBlockCount);
  }

  get count(): number {
    return this.#levels.length;
  }

  levelOf(node: number): number {
    return this.#levels[node];
  }

  maxNeighbors(level: number): number {
    return level === 0 ? this.#maxNeighbors0 : this.#maxNeighbors;
  }

  neighbors(node: number, level: number): number[] {
    if (level < 0 || level > this.levelOf(node)) throw new RangeError(`Node ${node} has no layer ${level}`);
    const start = this.linkStart(node, level);
    return Array.from(this.links.subarray(start, start + this.degree(node, level)));
  }

  /** How many links a node has on a layer. */
  degree(node: number, level: number): number {
    return this.#degrees[this.#block(node, level)];
  }

  /** Where a node's links on a layer start in `links`. */
  linkStart(node: number, level: number): number {
    return level === 0
      ? node * this.#maxNeighbors0
      : this.count * this.#maxNeighbors0 + (this.#upperBlocks[node] + level - 1) * this.#maxNeighbors;
  }

  /** Replaces a node's links on a layer with the first `count` of `ids`. */
  setNeighbors(node: number, level: number, ids: ArrayLike<number>, count = ids.length): void {
    if (count > this.maxNeighbors(level)) throw new RangeError(`${count} links exceed the ${this.maxNeighbors(level)} of layer ${level}`);
    const start = this.linkStart(node, level);
    for (let index = 0; index < count; index++) this.links[start + index] = ids[index];
    this.#degrees[this.#block(node, level)] = count;
  }

  /** Adds a link to a node's links on a layer, if there is room: true if it was added. */
  addNeighbor(node: number, level: number, id: number): boolean {
    const block = this.#block(node, level);
    const degree = this.#degrees[block];
    if (degree >= this.maxNeighbors(level)) return false;
    this.links[this.linkStart(node, level) + degree] = id;
    this.#degrees[block] = degree + 1;
    return true;
  }

  #block(node: number, level: number): number {
    return level === 0 ? node : this.count + this.#upperBlocks[node] + level - 1;
  }
}
