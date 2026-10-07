/** Room for this many entries at first; the heap doubles it whenever it fills. */
const INITIAL_CAPACITY = 64;

/**
 * A binary heap of ids by their distance, the nearest or the furthest on top, held in typed
 * arrays. A search keeps two: the candidates still to explore, nearest first, and the best
 * results so far, furthest first, so that the worst one is the one to drop.
 */
export class DistanceHeap {
  /** +1 keeps the nearest on top, -1 the furthest: the heap orders sign × distance, smallest first. */
  readonly #sign: 1 | -1;
  #ids = new Int32Array(INITIAL_CAPACITY);
  #keys = new Float64Array(INITIAL_CAPACITY);
  #size = 0;

  constructor(top: 'nearest' | 'furthest') {
    this.#sign = top === 'nearest' ? 1 : -1;
  }

  get size(): number {
    return this.#size;
  }

  /** The id on top. Only for a heap that isn't empty. */
  get topId(): number {
    return this.#ids[0];
  }

  /** The distance of the id on top. Only for a heap that isn't empty. */
  get topDistance(): number {
    return this.#sign * this.#keys[0];
  }

  clear(): void {
    this.#size = 0;
  }

  push(id: number, distance: number): void {
    if (this.#size === this.#ids.length) this.#grow();
    const key = this.#sign * distance;
    // Sift up: move parents with larger keys down until the new entry's place is found.
    let index = this.#size++;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.#keys[parent] <= key) break;
      this.#ids[index] = this.#ids[parent];
      this.#keys[index] = this.#keys[parent];
      index = parent;
    }
    this.#ids[index] = id;
    this.#keys[index] = key;
  }

  /** Removes the entry on top. */
  pop(): void {
    if (this.#size === 0) return;
    const size = --this.#size;
    const id = this.#ids[size];
    const key = this.#keys[size];
    // Sift down: move the last entry from the root down past every child with a smaller key.
    let index = 0;
    for (;;) {
      let child = 2 * index + 1;
      if (child >= size) break;
      if (child + 1 < size && this.#keys[child + 1] < this.#keys[child]) child++;
      if (this.#keys[child] >= key) break;
      this.#ids[index] = this.#ids[child];
      this.#keys[index] = this.#keys[child];
      index = child;
    }
    this.#ids[index] = id;
    this.#keys[index] = key;
  }

  #grow(): void {
    const ids = new Int32Array(this.#ids.length * 2);
    const keys = new Float64Array(this.#keys.length * 2);
    ids.set(this.#ids);
    keys.set(this.#keys);
    this.#ids = ids;
    this.#keys = keys;
  }
}
