import type { GalleryEntry } from '../atlas/gallery-data.ts';
import { PaintingTile } from '../atlas/painting-tile.ts';

/** A tile's width and its picture's height at most, in CSS pixels, and the least room between tiles in a row. */
const TILE = { width: 60, picture: 52, gap: 8 } as const;
/** The tiles in a row: half of them in the panel beside the stack, all of them under it on a tablet. */
const ROWS = 2;

/**
 * The paintings nearest the query so far, as the Atlas's tiles, each with its museum label while
 * pointed at; an empty slot stands for each still to come. They fill one row where it has room for
 * them all, and two rows elsewhere, sized again whenever the room changes.
 */
export class NearestTiles {
  readonly element = document.createElement('div');
  readonly #count: number;
  readonly #entry: (position: number) => Promise<GalleryEntry>;
  /** The paintings shown, or being read to be shown, by their positions: none at first, not even an empty row. */
  #shown: string | undefined;
  #tiles: PaintingTile[] = [];

  /** Room for `count` tiles, of the paintings `entry` reads. */
  constructor(count: number, entry: (position: number) => Promise<GalleryEntry>) {
    this.#count = count;
    this.#entry = entry;
    this.element.className = 'nearest-tiles';
    this.#fit();
    new ResizeObserver(() => this.#fit()).observe(this.element);
  }

  /** Shows the paintings at these positions, once they are read, unless others are asked for meanwhile. */
  async show(positions: readonly number[]): Promise<void> {
    const key = positions.join();
    if (key === this.#shown) return;
    this.#shown = key;
    const entries = await Promise.all(positions.map((position) => this.#entry(position)));
    if (this.#shown !== key) return;
    this.#tiles = entries.map((entry) => new PaintingTile(entry));
    const slots = Array.from({ length: this.#count - this.#tiles.length }, () => {
      const slot = document.createElement('span');
      slot.className = 'slot';
      return slot;
    });
    this.element.replaceChildren(...this.#tiles.map(({ element }) => element), ...slots);
    this.#fit();
  }

  /**
   * Sizes the tiles to their room: as many in a row as fit at full size, all of them or half,
   * and narrower where not even half fit. The slots take the tiles' size (see .nearest-tiles in lab.css).
   */
  #fit(): void {
    const room = this.element.clientWidth || (this.#count / ROWS) * (TILE.width + TILE.gap);
    const fitsAll = this.#count * TILE.width + (this.#count - 1) * TILE.gap <= room;
    const perRow = fitsAll ? this.#count : Math.ceil(this.#count / ROWS);
    const width = Math.min(TILE.width, Math.floor((room - (perRow - 1) * TILE.gap) / perRow));
    const picture = Math.round((width * TILE.picture) / TILE.width);
    this.element.style.setProperty('--per-row', String(perRow));
    this.element.style.setProperty('--tile-width', `${width}px`);
    this.element.style.setProperty('--tile-picture', `${picture}px`);
    for (const tile of this.#tiles) tile.size(width, picture);
    PaintingTile.keepLabelsWithin(this.#tiles, this.element.closest('main') ?? this.element);
  }
}
