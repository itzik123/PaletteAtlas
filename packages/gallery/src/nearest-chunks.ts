/** How many paintings a wall of matches hangs at most, the nearest first: the Atlas's search asks for one more, a painting searched by its own colors being among them. */
export const MATCHES = 600;
/**
 * How many of each painting's nearest the gallery stores, in the order the wall's search finds
 * them: a wall of matches' first page, so a painting's page and the first page of its Same colors
 * wall show them without the search index (5.4 MB).
 */
export const NEAREST_COUNT = 60;
/** Bytes per painting's position: 16 bits, room for a gallery of 65,535. */
const POSITION_BYTES = 2;
/** The mark of a place with no painting, in the list of a painting with fewer others than NEAREST_COUNT. */
const NONE = 0xffff;

/**
 * A chunk's lists of each painting's nearest paintings (by their positions in the gallery), as
 * one file: `count` 16-bit little-endian positions a painting, a shorter list padded with NONE.
 */
export function packNearest(lists: readonly (readonly number[])[], count = NEAREST_COUNT): Uint8Array {
  const bytes = new Uint8Array(lists.length * count * POSITION_BYTES);
  const view = new DataView(bytes.buffer);
  lists.forEach((list, row) => {
    if (list.length > count) throw new RangeError(`A list of ${list.length} nearest, where ${count} fit`);
    for (let place = 0; place < count; place++) {
      const position = list[place] ?? NONE;
      if (place < list.length && !(Number.isInteger(position) && position >= 0 && position < NONE)) {
        throw new RangeError(`Position ${position} doesn’t fit in 16 bits`);
      }
      view.setUint16((row * count + place) * POSITION_BYTES, position, true);
    }
  });
  return bytes;
}

/** The nearest paintings of the painting in a row of a chunk's file, as packNearest stored them. */
export function nearestInRow(bytes: Uint8Array, row: number, count = NEAREST_COUNT): number[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const list: number[] = [];
  for (let place = 0; place < count; place++) {
    const position = view.getUint16((row * count + place) * POSITION_BYTES, true);
    if (position === NONE) break;
    list.push(position);
  }
  return list;
}
