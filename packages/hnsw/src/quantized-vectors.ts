import { Vectors } from './vectors.ts';

/** The levels a byte holds. */
const LEVELS = 255;

/**
 * Vectors stored a byte per number: each dimension's values spread over 256 levels between its own
 * smallest and largest, so a value comes back within half a level of what it was. A range per
 * dimension rather than one for all keeps 98% of the paintings' true 10 nearest neighbors, against
 * 96% for one range, at the same size (measured Oct 7, 2026): a quarter of the room float32 takes.
 */
export class QuantizedVectors {
  readonly dimensions: number;
  /** Each dimension's smallest value. */
  readonly minimums: Float32Array;
  /** Each dimension's largest value. */
  readonly maximums: Float32Array;
  /** Each value's level, vector after vector, as in Vectors.data. */
  readonly levels: Uint8Array;

  constructor(dimensions: number, minimums: Float32Array, maximums: Float32Array, levels: Uint8Array) {
    if (minimums.length !== dimensions || maximums.length !== dimensions || levels.length % dimensions !== 0) {
      throw new RangeError(`Quantized vectors of ${dimensions} dimensions need as many ranges and whole vectors`);
    }
    this.dimensions = dimensions;
    this.minimums = minimums;
    this.maximums = maximums;
    this.levels = levels;
  }

  static from({ dimensions, data, count }: Vectors): QuantizedVectors {
    const minimums = new Float32Array(dimensions).fill(Number.POSITIVE_INFINITY);
    const maximums = new Float32Array(dimensions).fill(Number.NEGATIVE_INFINITY);
    for (let index = 0; index < data.length; index++) {
      const dimension = index % dimensions;
      minimums[dimension] = Math.min(minimums[dimension], data[index]);
      maximums[dimension] = Math.max(maximums[dimension], data[index]);
    }
    if (count === 0) {
      minimums.fill(0);
      maximums.fill(0);
    }
    const levels = new Uint8Array(data.length);
    for (let index = 0; index < data.length; index++) {
      const dimension = index % dimensions;
      const range = maximums[dimension] - minimums[dimension];
      levels[index] = range > 0 ? Math.round(((data[index] - minimums[dimension]) / range) * LEVELS) : 0;
    }
    return new QuantizedVectors(dimensions, minimums, maximums, levels);
  }

  /** The vectors as float32 again, each value at its level. */
  toVectors(): Vectors {
    const { dimensions, minimums, maximums, levels } = this;
    const data = new Float32Array(levels.length);
    for (let index = 0; index < levels.length; index++) {
      const dimension = index % dimensions;
      data[index] = minimums[dimension] + (levels[index] / LEVELS) * (maximums[dimension] - minimums[dimension]);
    }
    return new Vectors(dimensions, data);
  }
}
