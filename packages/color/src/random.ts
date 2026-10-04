/** A source of random numbers in [0, 1). */
export interface Random {
  next(): number;
}

/** 2^32, which turns an unsigned 32-bit integer into a fraction in [0, 1). */
const UINT32_RANGE = 2 ** 32;
/** The step mulberry32 adds to its state before each number. */
const STATE_INCREMENT = 0x6d2b79f5;

/** An index drawn with probability proportional to its weight, or -1 if every weight is zero. */
export function drawIndex(weights: Float64Array, random: Random): number {
  let total = 0;
  let lastPossible = -1;
  for (let index = 0; index < weights.length; index++) {
    total += weights[index];
    if (weights[index] > 0) lastPossible = index;
  }
  let remaining = random.next() * total;
  for (let index = 0; index < weights.length; index++) {
    remaining -= weights[index];
    if (remaining < 0) return index;
  }
  return lastPossible; // Rounding can leave a sliver past the last index.
}

/**
 * A seeded pseudo-random generator: mulberry32 by Tommy Ettinger, tiny and fast, and plenty for
 * seeding k-means. The same seed gives the same numbers, so palettes are reproducible.
 */
export class SeededRandom implements Random {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0;
  }

  next(): number {
    this.#state = (this.#state + STATE_INCREMENT) >>> 0;
    // mulberry32's own mixing steps and shift constants.
    let mixed = Math.imul(this.#state ^ (this.#state >>> 15), this.#state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
  }
}
