/** Room for this many bytes at first; a writer doubles it whenever it fills. */
const INITIAL_CAPACITY = 1024;
/** A variable-length integer holds 7 bits per byte; the high bit says another byte follows. */
const VARINT_BITS = 7;
const VARINT_MORE = 0x80;
const VARINT_LOW_BITS = 0x7f;
/** Bytes a 32-bit integer can take as a variable-length integer. */
const VARINT_MAX_BYTES = 5;

/**
 * Writes numbers into a growing array of bytes, little-endian, as an index file (or the gallery's
 * map of the paintings) holds them.
 * Small unsigned integers can be written as variable-length integers (LEB128, as Lucene stores
 * its graphs' links): 7 bits per byte, so a number below 128 takes one byte.
 */
export class ByteWriter {
  #bytes = new Uint8Array(INITIAL_CAPACITY);
  #view = new DataView(this.#bytes.buffer);
  #length = 0;

  uint8(value: number): void {
    this.#reserve(1);
    this.#view.setUint8(this.#length, value);
    this.#length += 1;
  }

  uint16(value: number): void {
    this.#reserve(2);
    this.#view.setUint16(this.#length, value, true);
    this.#length += 2;
  }

  uint32(value: number): void {
    this.#reserve(4);
    this.#view.setUint32(this.#length, value, true);
    this.#length += 4;
  }

  float32(value: number): void {
    this.#reserve(4);
    this.#view.setFloat32(this.#length, value, true);
    this.#length += 4;
  }

  /** An unsigned integer below 2^32, in as few bytes as it needs. */
  varint(value: number): void {
    this.#reserve(VARINT_MAX_BYTES);
    let rest = value >>> 0;
    while (rest >= VARINT_MORE) {
      this.#bytes[this.#length++] = (rest & VARINT_LOW_BITS) | VARINT_MORE;
      rest >>>= VARINT_BITS;
    }
    this.#bytes[this.#length++] = rest;
  }

  bytes(values: Uint8Array): void {
    this.#reserve(values.length);
    this.#bytes.set(values, this.#length);
    this.#length += values.length;
  }

  /** What was written, as a copy of exactly its bytes. */
  toBytes(): Uint8Array {
    return this.#bytes.slice(0, this.#length);
  }

  #reserve(count: number): void {
    if (this.#length + count <= this.#bytes.length) return;
    let capacity = this.#bytes.length * 2;
    while (capacity < this.#length + count) capacity *= 2;
    const bytes = new Uint8Array(capacity);
    bytes.set(this.#bytes.subarray(0, this.#length));
    this.#bytes = bytes;
    this.#view = new DataView(bytes.buffer);
  }
}

/** Reads back what a ByteWriter wrote, in the same order; reading past the end throws a RangeError. */
export class ByteReader {
  readonly #bytes: Uint8Array;
  readonly #view: DataView;
  #position = 0;

  constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
    this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  /** Whether every byte has been read. */
  get atEnd(): boolean {
    return this.#position === this.#bytes.length;
  }

  uint8(): number {
    return this.#view.getUint8(this.#advance(1));
  }

  uint16(): number {
    return this.#view.getUint16(this.#advance(2), true);
  }

  uint32(): number {
    return this.#view.getUint32(this.#advance(4), true);
  }

  float32(): number {
    return this.#view.getFloat32(this.#advance(4), true);
  }

  varint(): number {
    let value = 0;
    for (let shift = 0; shift < VARINT_BITS * VARINT_MAX_BYTES; shift += VARINT_BITS) {
      const byte = this.uint8();
      value += (byte & VARINT_LOW_BITS) * 2 ** shift;
      if (byte < VARINT_MORE) return value;
    }
    throw new RangeError('A variable-length integer runs past 32 bits');
  }

  /** The next `count` bytes, as a view rather than a copy. */
  bytes(count: number): Uint8Array {
    const start = this.#advance(count);
    return this.#bytes.subarray(start, start + count);
  }

  /** Moves past `count` bytes and returns where they start. */
  #advance(count: number): number {
    const start = this.#position;
    if (start + count > this.#bytes.length) throw new RangeError(`The data ends after ${this.#bytes.length} bytes, before its end`);
    this.#position += count;
    return start;
  }
}
