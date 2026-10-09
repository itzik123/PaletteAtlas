import type { GalleryEntry } from '../atlas/gallery-data.ts';
import { PaintingTile } from '../atlas/painting-tile.ts';

/** A tile's width and its picture's height at most, in CSS pixels, and the least room between tiles in a row. */
const TILE = { width: 60, picture: 52, gap: 8 } as const;
/** The tiles in a row. */
const PER_ROW = 5;

/**
 * The paintings nearest the query so far, as the Atlas's tiles, each with its museum label while
 * pointed at; an empty slot stands for each still to come.
 */
export class NearestTiles {
  readonly element = document.createElement('div');
  readonly #count: number;
  readonly #entry: (position: number) => Promise<GalleryEntry>;
  /** The paintings shown, or being read to be shown, by their positions: none at first, not even an empty row. */
  #shown: string | undefined;

  /** Room for `count` tiles, of the paintings `entry` reads. */
  constructor(count: number, entry: (position: number) => Promise<GalleryEntry>) {
    this.#count = count;
    this.#entry = entry;
    this.element.className = 'nearest-tiles';
    this.element.style.setProperty('--per-row', String(PER_ROW));
    this.element.style.setProperty('--tile-width', `${TILE.width}px`);
    this.element.style.setProperty('--tile-picture', `${TILE.picture}px`);
  }

  /** Shows the paintings at these positions, once they are read, unless others are asked for meanwhile. */
  async show(positions: readonly number[]): Promise<void> {
    const key = positions.join();
    if (key === this.#shown) return;
    this.#shown = key;
    const entries = await Promise.all(positions.map((position) => this.#entry(position)));
    if (this.#shown !== key) return;
    const width = this.#tileWidth();
    const picture = Math.round((width * TILE.picture) / TILE.width);
    // The slots take the tiles' size (see .nearest-tiles in lab.css).
    this.element.style.setProperty('--tile-width', `${width}px`);
    this.element.style.setProperty('--tile-picture', `${picture}px`);
    const tiles = entries.map((entry) => new PaintingTile(entry));
    for (const tile of tiles) tile.size(width, picture);
    const slots = Array.from({ length: this.#count - tiles.length }, () => {
      const slot = document.createElement('span');
      slot.className = 'slot';
      return slot;
    });
    this.element.replaceChildren(...tiles.map(({ element }) => element), ...slots);
    PaintingTile.keepLabelsWithin(tiles, this.element.closest('main') ?? this.element);
  }

  /** As wide as a row of them fits, up to TILE.width. */
  #tileWidth(): number {
    const room = this.element.clientWidth || PER_ROW * (TILE.width + TILE.gap);
    return Math.min(TILE.width, Math.floor((room - (PER_ROW - 1) * TILE.gap) / PER_ROW));
  }
}
