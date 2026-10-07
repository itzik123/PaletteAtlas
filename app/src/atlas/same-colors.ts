import { AXIS_ICONS, NEXT_ICON } from '../icons.ts';
import type { GalleryEntry } from './gallery-data.ts';
import { justifiedRows, type Row } from './justified-rows.ts';
import { PaintingTile } from './painting-tile.ts';

/** How many of the nearest paintings are weighed for the rows: more than ever fit. */
export const SAME_COLORS_COUNT = 16;
/** The tallest the pictures stand in the row beside a painting. */
const MAX_HEIGHT = 110;
/** Pictures shorter than this are too small to make out, so a button leads to them instead. */
const MIN_HEIGHT = 56;
/** Where the painting's page stacks into one column and scrolls (see atlas.css). */
const ONE_COLUMN = '(max-width: 860px)';
/** In one column: rows of pictures this tall, as many as fill with the paintings weighed, up to `rows`. */
const COLUMN_ROW = { height: 96, rows: 3 } as const;
/** Room left at the end of each row, so that rounding never pushes its last tile onto the next. */
const ROUNDING_ROOM = 1;

/** How the same colors are shown: a row of paintings, a button, or, without room even for that, not at all. */
type Fit = 'row' | 'button' | 'none';

/**
 * The paintings whose colors lie nearest a painting's, under its strips on its page: one row, as
 * tall as the page has room for down to `bottom()` (a page position in pixels), so the page still
 * fits the screen, or, with too little room, a button. Both lead on to all of them on the Atlas's
 * wall. In one column, where the page scrolls anyway, a few rows instead. Their museum labels open
 * above them, toward the page rather than past its foot.
 */
export class SameColors {
  readonly element = document.createElement('section');
  readonly #row = document.createElement('div');
  readonly #bottom: () => number;
  #tiles: PaintingTile[] = [];
  /** How much taller a tile stands than its picture: its strip and outline. */
  #extra: number | undefined;

  constructor(id: string, paintings: Promise<readonly GalleryEntry[]>, bottom: () => number) {
    this.#bottom = bottom;
    const matches = `./atlas.html?like=${id}`;
    this.element.className = 'same-colors';
    this.element.setAttribute('aria-label', 'Same colors');
    this.element.hidden = true;
    this.element.innerHTML = `
      <a class="same-colors-heading" href="${matches}">${AXIS_ICONS.color}<span>Same colors</span>${NEXT_ICON}</a>
      <a class="pill same-colors-button" href="${matches}">${AXIS_ICONS.color}<span>Same colors</span></a>
    `;
    this.#row.className = 'same-colors-row';
    this.element.querySelector('.same-colors-heading')?.after(this.#row);
    paintings.then(
      async (entries) => {
        this.#tiles = entries.map((entry) => new PaintingTile(entry));
        this.element.hidden = this.#tiles.length === 0;
        // The title's font changes its height as it arrives, and with it the room left.
        await document.fonts.ready;
        this.fit();
      },
      // Without the search index, the page shows no way to the same colors.
      () => undefined,
    );
  }

  /** Lays the paintings out in the room they have, or gives way to the button. Again whenever the room may have changed. */
  fit(): void {
    if (this.#tiles.length === 0) return;
    this.#row.replaceChildren();
    // Measured as a row, which the button may then take the place of.
    this.#show('row');
    const oneColumn = matchMedia(ONE_COLUMN).matches;
    const height = oneColumn ? COLUMN_ROW.height : Math.min(this.#room() - this.#tileExtra(), MAX_HEIGHT);
    const rows = height >= MIN_HEIGHT ? this.#rows(height, oneColumn ? COLUMN_ROW.rows : 1) : [];
    if (rows.length > 0 && rows.every((row) => row.height >= MIN_HEIGHT)) {
      this.#hang(rows);
      return;
    }
    this.#show('button');
    // Where even the button would reach past the room, the page goes without.
    if (!oneColumn && this.element.getBoundingClientRect().bottom + scrollY > this.#bottom()) this.#show('none');
  }

  #show(fit: Fit): void {
    this.element.dataset.fit = fit;
  }

  /** The height from the row's top down to `bottom()`. */
  #room(): number {
    return this.#bottom() - (this.#row.getBoundingClientRect().top + scrollY);
  }

  /**
   * As many full rows as the paintings fill, at most `most`, their pictures at most `height` tall;
   * just the one if they fill none. A painting too wide to stand MIN_HEIGHT tall across the whole
   * row (a handscroll) is left out.
   */
  #rows(height: number, most: number): readonly (Row & { readonly tiles: readonly PaintingTile[] })[] {
    const width = this.#row.clientWidth - ROUNDING_ROOM;
    const extra = 2 * this.#border();
    const tiles = this.#tiles.filter(({ aspect }) => aspect * MIN_HEIGHT + extra <= width);
    const gap = Number.parseFloat(getComputedStyle(this.#row).columnGap);
    return justifiedRows(
      tiles.map(({ aspect }) => aspect),
      { width, height, gap, extra },
    )
      .filter((row, index) => row.full || index === 0)
      .slice(0, most)
      .map((row) => ({ ...row, tiles: tiles.slice(row.start, row.end) }));
  }

  #hang(rows: readonly (Row & { readonly tiles: readonly PaintingTile[] })[]): void {
    const border = this.#border();
    for (const { tiles, height } of rows) {
      for (const tile of tiles) {
        tile.size(tile.aspect * height + 2 * border, height);
        this.#row.append(tile.element);
      }
    }
    PaintingTile.keepLabelsWithin(rows.flatMap(({ tiles }) => tiles), this.#row);
  }

  /** A tile's outline width. */
  #border(): number {
    const tile = this.#tiles[0]?.element;
    if (!tile) return 0;
    const shown = tile.isConnected;
    if (!shown) this.#row.append(tile);
    const border = Number.parseFloat(getComputedStyle(tile).borderLeftWidth);
    if (!shown) tile.remove();
    return border;
  }

  /** How much taller a tile stands than its picture, measured once on the first tile. */
  #tileExtra(): number {
    const tile = this.#tiles[0];
    if (this.#extra === undefined && tile) {
      tile.size(MAX_HEIGHT, MAX_HEIGHT);
      this.#row.append(tile.element);
      this.#extra = tile.element.offsetHeight - MAX_HEIGHT;
      tile.element.remove();
    }
    return this.#extra ?? 0;
  }
}
