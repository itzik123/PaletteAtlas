/**
 * Vectors of one length, stored end to end in one typed array: vector i is
 * data[i × dimensions, (i + 1) × dimensions). Indexes read them in place, so that a search makes no
 * object per vector it compares.
 */
export class Vectors {
  readonly dimensions: number;
  readonly data: Float32Array;

  constructor(dimensions: number, data: Float32Array) {
    if (!Number.isInteger(dimensions) || dimensions < 1) throw new RangeError(`dimensions must be a positive integer, not ${dimensions}`);
    if (data.length % dimensions !== 0) throw new RangeError(`${data.length} numbers don't make vectors of ${dimensions}`);
    this.dimensions = dimensions;
    this.data = data;
  }

  get count(): number {
    return this.data.length / this.dimensions;
  }

  /** Vector i, as a view of the stored numbers rather than a copy. */
  vector(id: number): Float32Array {
    if (!Number.isInteger(id) || id < 0 || id >= this.count) throw new RangeError(`Vector ${id} is outside 0 to ${this.count - 1}`);
    return this.data.subarray(id * this.dimensions, (id + 1) * this.dimensions);
  }
}
