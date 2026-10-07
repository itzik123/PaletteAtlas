/** The largest mark a Uint32Array holds; past it, every mark is reset. */
const MAX_MARK = 0xffff_ffff;

/**
 * The nodes a search has reached, emptied in constant time: each search marks nodes with a number
 * of its own, and only marks with the current number count. hnswlib keeps its visited lists the
 * same way, which spares a search from clearing an array as long as the index.
 */
export class VisitedSet {
  readonly #marks: Uint32Array;
  #current = 1;

  constructor(size: number) {
    this.#marks = new Uint32Array(size);
  }

  /** Forgets every node visited so far. */
  clear(): void {
    if (this.#current === MAX_MARK) {
      this.#marks.fill(0);
      this.#current = 0;
    }
    this.#current++;
  }

  /** Marks a node as visited: true if it wasn't yet. */
  visit(node: number): boolean {
    if (this.#marks[node] === this.#current) return false;
    this.#marks[node] = this.#current;
    return true;
  }
}
