import type { GalleryEntry } from './gallery-data.ts';
import { justifiedRows } from './justified-rows.ts';
import { PaintingTile } from './painting-tile.ts';

/** How tall a wall's rows aim to be: a share of the wall's width, kept within bounds in CSS pixels. */
export interface RowHeights {
  readonly share: number;
  readonly min: number;
  readonly max: number;
}

/** The whole gallery's rows: about six paintings a row, three on a phone. */
export const GALLERY_ROWS: RowHeights = { share: 0.16, min: 110, max: 200 };
/** The rows of the paintings nearest some colors, a quarter taller, so that their colors show more. */
export const MATCH_ROWS: RowHeights = { share: 0.2, min: 138, max: 250 };

/** Room left at the end of each row, so that rounding never pushes its last tile onto the next. */
const ROUNDING_ROOM = 1;

/**
 * The Atlas's wall: paintings at their own shapes in justified rows, each filling the wall's width,
 * laid out again whenever the wall changes width or more paintings arrive.
 */
export class Wall {
  readonly element = document.createElement('div');
  readonly #rows: RowHeights;
  readonly #tiles: PaintingTile[] = [];
  /** Where the last row starts: rows before it are full, and stay as they are when paintings are added. */
  #lastRow = 0;

  constructor(rows: RowHeights) {
    this.#rows = rows;
    this.element.className = 'wall';
    new ResizeObserver(() => this.#layout(0)).observe(this.element);
  }

  /** Hangs more paintings after the last. */
  append(entries: readonly GalleryEntry[]): void {
    const tiles = entries.map((entry) => new PaintingTile(entry));
    this.#tiles.push(...tiles);
    this.element.append(...tiles.map(({ element }) => element));
    this.#layout(this.#lastRow);
  }

  /**
   * The first painting whose tile reaches below the screen's top, and how far below it its tile's
   * top is. Tiles reach down row by row, so a binary search finds it.
   */
  topPainting(): { painting: number; offset: number } | undefined {
    let low = 0;
    let high = this.#tiles.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (this.#tiles[middle].element.getBoundingClientRect().bottom > 0) high = middle;
      else low = middle + 1;
    }
    const tile = this.#tiles[low];
    return tile && { painting: low, offset: tile.element.getBoundingClientRect().top };
  }

  /** Scrolls the page so that a painting's tile is this far below the screen's top. */
  scrollTo(painting: number, offset: number): void {
    const tile = this.#tiles[painting];
    if (tile) window.scrollTo(0, window.scrollY + tile.element.getBoundingClientRect().top - offset);
  }

  /** Lays the rows out again from a row's first tile on. */
  #layout(from: number): void {
    const width = this.element.clientWidth - ROUNDING_ROOM;
    const first = this.#tiles[0]?.element;
    if (!first || width <= 0) return;
    const style = getComputedStyle(this.element);
    const { share, min, max } = this.#rows;
    const border = Number.parseFloat(getComputedStyle(first).borderLeftWidth);
    const rows = justifiedRows(
      this.#tiles.slice(from).map(({ aspect }) => aspect),
      {
        width,
        height: Math.min(Math.max(width * share, min), max),
        gap: Number.parseFloat(style.columnGap),
        extra: 2 * border,
      },
    );
    for (const { start, end, height } of rows) {
      for (const tile of this.#tiles.slice(from + start, from + end)) tile.size(tile.aspect * height + 2 * border, height);
    }
    PaintingTile.keepLabelsWithin(this.#tiles.slice(from), this.element);
    this.#lastRow = from + (rows.at(-1)?.start ?? 0);
  }
}
