/** Iterations of the power method per axis: the paintings' first axes settle in a few dozen. */
const POWER_ITERATIONS = 200;
/**
 * The share of the vectors at each end of an axis left beyond its 0 to 1, so a few outliers don't
 * shrink the rest: few enough that the rest's edges, where they thin out, lie within it, and the
 * Lab never cuts them off (one in 2,000, 24 of the gallery's paintings).
 */
const TRIM = 0.0005;
/** A place on an axis is stored in this many steps across the axis's range of places. */
const PLACE_STEPS = 65_535;
/** The file's first bytes, "PMAP", which tell it from anything else. */
const MAGIC = Uint8Array.from('PMAP', (letter) => letter.charCodeAt(0));
/** The layout in PaintingMap.toBytes; a change to it gets a new version, and old files are refused rather than misread. */
const VERSION = 1;
/** Red, green and blue. */
const CHANNELS = 3;
const FLOAT_BYTES = 4;
const PLACE_BYTES = 2;

/** A place on the map: across, from 0 at its left, and down, from 0 at its back. */
export type MapPlace = [x: number, y: number];

/**
 * A plane through vectors, along the two directions in which they spread most (their principal
 * components), each turned to rise with a guide; a vector's place is its projection on the plane,
 * scaled so that all but the few at either end of each axis lie from 0 to 1. Both axes keep the
 * vectors' own scale, so the map is `aspect` times wider than deep.
 *
 * Value Object: immutable, its numbers stored as float32, as a file holds them.
 */
export class MapProjection {
  /** The vectors' mean, where the plane passes. */
  readonly mean: Float32Array;
  /** The plane's two axes, unit vectors: across, then down. */
  readonly axes: readonly [Float32Array, Float32Array];
  /** Where each axis's 0 lies, and how long its 0 to 1 is, in the vectors' units. */
  readonly origin: readonly [number, number];
  readonly span: readonly [number, number];
  /** The share of the vectors' variance that lies along the plane: how faithful the map is. */
  readonly held: number;

  constructor(mean: Float32Array, axes: readonly [Float32Array, Float32Array], origin: readonly [number, number], span: readonly [number, number], held: number) {
    this.mean = mean;
    this.axes = axes;
    this.origin = [Math.fround(origin[0]), Math.fround(origin[1])];
    this.span = [Math.fround(span[0]), Math.fround(span[1])];
    this.held = Math.fround(held);
  }

  /**
   * The plane through `data` (vectors of `dimensions` numbers, end to end), each axis turned so
   * that places along it rise with its guide (a number per vector): on the gallery, lighter
   * paintings to the right and warmer ones to the front.
   */
  static fit(data: Float32Array, dimensions: number, guides: readonly [ArrayLike<number>, ArrayLike<number>]): MapProjection {
    const count = data.length / dimensions;
    const mean = new Float64Array(dimensions);
    for (let vector = 0; vector < count; vector++) for (let d = 0; d < dimensions; d++) mean[d] += data[vector * dimensions + d] / count;
    const covariance = covarianceOf(data, dimensions, mean);
    let total = 0;
    for (let d = 0; d < dimensions; d++) total += covariance[d * dimensions + d];
    const [across, down] = [0, 1].map(() => leadingAxis(covariance, dimensions));
    const axes = [across.vector, down.vector].map((axis, index) => {
      const turned = agreement(data, dimensions, mean, axis, guides[index]) < 0 ? axis.map((value) => -value) : axis;
      return Float32Array.from(turned);
    }) as [Float32Array, Float32Array];
    const shape = new MapProjection(Float32Array.from(mean), axes, [0, 0], [1, 1], total > 0 ? (across.value + down.value) / total : 1);
    const bounds = ([0, 1] as const).map((axis) => {
      const along = Float64Array.from({ length: count }, (_, vector) => shape.place(data.subarray(vector * dimensions, (vector + 1) * dimensions))[axis]).sort();
      const low = along[Math.floor((count - 1) * TRIM)];
      const high = along[Math.ceil((count - 1) * (1 - TRIM))];
      return [low, high - low || 1];
    });
    return new MapProjection(shape.mean, axes, [bounds[0][0], bounds[1][0]], [bounds[0][1], bounds[1][1]], shape.held);
  }

  /** The map's width over its depth: both axes keep the vectors' scale. */
  get aspect(): number {
    return this.span[0] / this.span[1];
  }

  /** Where a vector lies on the map; one beyond the few at either end lies short of 0 or past 1. */
  place(vector: ArrayLike<number>): MapPlace {
    const along = (axis: number): number => {
      const direction = this.axes[axis];
      let sum = 0;
      for (let d = 0; d < direction.length; d++) sum += (vector[d] - this.mean[d]) * direction[d];
      return (sum - this.origin[axis]) / this.span[axis];
    };
    return [along(0), along(1)];
  }
}

/**
 * The gallery's paintings laid out on a map, for the Lab: each painting's place, where the
 * projection puts its color scheme vector, so that paintings near each other on the map have
 * color schemes near each other; and each painting's color, its color strip averaged, to draw it
 * by. Paintings are in gallery order.
 */
export class PaintingMap {
  readonly projection: MapProjection;
  /** Each painting's place, x then y (see MapProjection.place). */
  readonly places: Float32Array;
  /** Each painting's color as 8-bit sRGB: red, green, blue. */
  readonly colors: Uint8Array;

  private constructor(projection: MapProjection, places: Float32Array, colors: Uint8Array) {
    if (colors.length !== (places.length / 2) * CHANNELS) throw new RangeError(`${colors.length / CHANNELS} colors for ${places.length / 2} places`);
    this.projection = projection;
    this.places = places;
    this.colors = colors;
  }

  /** Paintings placed by their vectors (end to end, as long as the projection's), with their colors. */
  static of(projection: MapProjection, vectors: Float32Array, colors: Uint8Array): PaintingMap {
    const dimensions = projection.mean.length;
    const count = vectors.length / dimensions;
    const places = new Float32Array(count * 2);
    for (let painting = 0; painting < count; painting++) places.set(projection.place(vectors.subarray(painting * dimensions, (painting + 1) * dimensions)), painting * 2);
    return new PaintingMap(projection, places, colors);
  }

  get count(): number {
    return this.places.length / 2;
  }

  /**
   * The map as bytes, little-endian:
   *
   *   "PMAP", version             5 bytes
   *   count, dimensions           uint32 each
   *   held                        float32
   *   mean, across, down          float32 × dimensions each
   *   origin, span                float32 × 2 each: across, then down
   *   places' range               float32 × 4: across from, to; down from, to
   *   places                      uint16 × count across, then uint16 × count down, in PLACE_STEPS steps of their range
   *   colors                      uint8 × count red, then green, then blue
   *
   * Each kind of number lies in a run of its own, which compresses better (the file is gzipped on
   * its way to the browser).
   */
  toBytes(): Uint8Array {
    const { projection, places, colors, count } = this;
    const dimensions = projection.mean.length;
    const writer = new FixedWriter(
      MAGIC.length + 1 + 2 * 4 + FLOAT_BYTES * (1 + 3 * dimensions + 4 + 4) + count * (2 * PLACE_BYTES + CHANNELS),
    );
    writer.bytes(MAGIC);
    writer.bytes(Uint8Array.of(VERSION));
    writer.uint32(count);
    writer.uint32(dimensions);
    writer.float32(projection.held);
    for (const values of [projection.mean, ...projection.axes]) values.forEach((value) => writer.float32(value));
    for (const pair of [projection.origin, projection.span]) pair.forEach((value) => writer.float32(value));
    const ranges = [0, 1].map((axis) => {
      let low = Number.POSITIVE_INFINITY;
      let high = Number.NEGATIVE_INFINITY;
      for (let painting = 0; painting < count; painting++) {
        low = Math.min(low, places[painting * 2 + axis]);
        high = Math.max(high, places[painting * 2 + axis]);
      }
      return count > 0 ? [low, high] : [0, 0];
    });
    ranges.flat().forEach((value) => writer.float32(value));
    for (const [axis, [low, high]] of ranges.entries()) {
      for (let painting = 0; painting < count; painting++) {
        writer.uint16(high > low ? Math.round(((places[painting * 2 + axis] - low) / (high - low)) * PLACE_STEPS) : 0);
      }
    }
    for (let channel = 0; channel < CHANNELS; channel++) {
      writer.bytes(Uint8Array.from({ length: count }, (_, painting) => colors[painting * CHANNELS + channel]));
    }
    return writer.done();
  }

  /** Reads a map that toBytes wrote. */
  static fromBytes(bytes: Uint8Array): PaintingMap {
    if (bytes.length < MAGIC.length || MAGIC.some((letter, index) => bytes[index] !== letter)) throw new Error('These bytes are not a painting map');
    const reader = new FixedReader(bytes, MAGIC.length);
    const version = reader.uint8();
    if (version !== VERSION) throw new Error(`A painting map of version ${version}; this code reads version ${VERSION}`);
    const count = reader.uint32();
    const dimensions = reader.uint32();
    const held = reader.float32();
    const floats = (length: number): Float32Array => Float32Array.from({ length }, () => reader.float32());
    const mean = floats(dimensions);
    const axes: [Float32Array, Float32Array] = [floats(dimensions), floats(dimensions)];
    const [originX, originY, spanX, spanY] = floats(4);
    const ranges = floats(4);
    const projection = new MapProjection(mean, axes, [originX, originY], [spanX, spanY], held);
    const places = new Float32Array(count * 2);
    for (let axis = 0; axis < 2; axis++) {
      const low = ranges[axis * 2];
      const high = ranges[axis * 2 + 1];
      for (let painting = 0; painting < count; painting++) places[painting * 2 + axis] = low + (reader.uint16() / PLACE_STEPS) * (high - low);
    }
    const colors = new Uint8Array(count * CHANNELS);
    for (let channel = 0; channel < CHANNELS; channel++) {
      for (let painting = 0; painting < count; painting++) colors[painting * CHANNELS + channel] = reader.uint8();
    }
    if (!reader.atEnd) throw new RangeError('A painting map with bytes left over');
    return new PaintingMap(projection, places, colors);
  }
}

/** The vectors' covariance matrix, dimensions × dimensions. */
function covarianceOf(data: Float32Array, dimensions: number, mean: Float64Array): Float64Array {
  const count = data.length / dimensions;
  const covariance = new Float64Array(dimensions * dimensions);
  const centered = new Float64Array(dimensions);
  for (let vector = 0; vector < count; vector++) {
    for (let d = 0; d < dimensions; d++) centered[d] = data[vector * dimensions + d] - mean[d];
    for (let row = 0; row < dimensions; row++) {
      for (let column = row; column < dimensions; column++) covariance[row * dimensions + column] += centered[row] * centered[column];
    }
  }
  for (let row = 0; row < dimensions; row++) {
    for (let column = row; column < dimensions; column++) {
      covariance[row * dimensions + column] /= count;
      covariance[column * dimensions + row] = covariance[row * dimensions + column];
    }
  }
  return covariance;
}

/**
 * The direction of a symmetric matrix's largest eigenvalue, by the power method, and the value;
 * the matrix then loses that direction (deflation), so the next call finds the one after.
 */
function leadingAxis(matrix: Float64Array, dimensions: number): { vector: Float64Array; value: number } {
  let vector = Float64Array.from({ length: dimensions }, (_, d) => 1 + d / dimensions);
  let value = 0;
  for (let iteration = 0; iteration < POWER_ITERATIONS; iteration++) {
    const next = new Float64Array(dimensions);
    for (let row = 0; row < dimensions; row++) for (let column = 0; column < dimensions; column++) next[row] += matrix[row * dimensions + column] * vector[column];
    value = Math.hypot(...next);
    if (value === 0) break;
    vector = next.map((entry) => entry / value);
  }
  for (let row = 0; row < dimensions; row++) for (let column = 0; column < dimensions; column++) matrix[row * dimensions + column] -= value * vector[row] * vector[column];
  return { vector, value };
}

/** How places along an axis rise with a guide: positive if they rise together. */
function agreement(data: Float32Array, dimensions: number, mean: Float64Array, axis: Float64Array, guide: ArrayLike<number>): number {
  let sum = 0;
  for (let vector = 0; vector < guide.length; vector++) {
    let along = 0;
    for (let d = 0; d < dimensions; d++) along += (data[vector * dimensions + d] - mean[d]) * axis[d];
    sum += along * guide[vector];
  }
  return sum;
}

/** Writes numbers, little-endian, into bytes of a size known beforehand. */
class FixedWriter {
  readonly #bytes: Uint8Array;
  readonly #view: DataView;
  #at = 0;

  constructor(length: number) {
    this.#bytes = new Uint8Array(length);
    this.#view = new DataView(this.#bytes.buffer);
  }

  bytes(values: Uint8Array): void {
    this.#bytes.set(values, this.#at);
    this.#at += values.length;
  }

  uint16(value: number): void {
    this.#view.setUint16(this.#at, value, true);
    this.#at += PLACE_BYTES;
  }

  uint32(value: number): void {
    this.#view.setUint32(this.#at, value, true);
    this.#at += 4;
  }

  float32(value: number): void {
    this.#view.setFloat32(this.#at, value, true);
    this.#at += FLOAT_BYTES;
  }

  done(): Uint8Array {
    if (this.#at !== this.#bytes.length) throw new Error(`Wrote ${this.#at} of ${this.#bytes.length} bytes`);
    return this.#bytes;
  }
}

/** Reads numbers, little-endian, refusing to read past the end. */
class FixedReader {
  readonly #view: DataView;
  #at: number;

  constructor(bytes: Uint8Array, start: number) {
    this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.#at = start;
  }

  get atEnd(): boolean {
    return this.#at === this.#view.byteLength;
  }

  uint8(): number {
    return this.#view.getUint8(this.#advance(1));
  }

  uint16(): number {
    return this.#view.getUint16(this.#advance(PLACE_BYTES), true);
  }

  uint32(): number {
    return this.#view.getUint32(this.#advance(4), true);
  }

  float32(): number {
    return this.#view.getFloat32(this.#advance(FLOAT_BYTES), true);
  }

  /** Where the next `length` bytes start; DataView throws a RangeError for any past the end. */
  #advance(length: number): number {
    const at = this.#at;
    this.#at += length;
    if (this.#at > this.#view.byteLength) throw new RangeError('The painting map ends too soon');
    return at;
  }
}
