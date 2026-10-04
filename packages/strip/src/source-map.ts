/** Marks a pixel that belongs to no segment. */
export const NO_SEGMENT = -1;

/**
 * Which strip segment each pixel of an image belongs to, so that every segment remembers the
 * pixels it came from; hover linking and fold-back are built on it. Segments are numbered
 * along the strip from 0, and a pixel outside every segment holds NO_SEGMENT.
 *
 * Value Object: immutable once built, with one entry per pixel in a typed array. The map takes
 * ownership of the array it is given.
 */
export class SourceMap {
  readonly width: number;
  readonly height: number;
  readonly segmentCount: number;
  readonly #segments: Int32Array;

  constructor(width: number, height: number, segmentCount: number, segments: Int32Array) {
    if (segments.length !== width * height) {
      throw new RangeError(`Expected ${width * height} entries for ${width} × ${height} pixels, got ${segments.length}`);
    }
    for (const segment of segments) {
      if (segment < NO_SEGMENT || segment >= segmentCount) {
        throw new RangeError(`Segment ${segment} is outside 0 to ${segmentCount - 1}`);
      }
    }
    this.width = width;
    this.height = height;
    this.segmentCount = segmentCount;
    this.#segments = segments;
  }

  /**
   * Cuts a sequence of pixels, given by index (y × width + x) in strip order, into at most
   * `segments` runs of nearly equal length, one segment each. Pixels left out of the sequence
   * belong to no segment.
   */
  static fromSequence(width: number, height: number, sequence: ArrayLike<number>, segments: number): SourceMap {
    // At most one run per pixel, so that none is empty.
    const count = Math.min(Math.max(1, segments), sequence.length);
    const map = new Int32Array(width * height).fill(NO_SEGMENT);
    for (let position = 0; position < sequence.length; position++) {
      map[sequence[position]] = Math.floor((position * count) / sequence.length);
    }
    return new SourceMap(width, height, count, map);
  }

  /** The segment of the pixel at (x, y), or NO_SEGMENT. */
  segmentAt(x: number, y: number): number {
    return this.#segments[y * this.width + x];
  }
}
