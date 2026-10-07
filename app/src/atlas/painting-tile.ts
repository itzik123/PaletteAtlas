import { BYTES_PER_PIXEL } from '@palette-atlas/color';
import { thumbnailWidthAtLeast } from '@palette-atlas/gallery';
import { imageCanvas } from '../image-adapters.ts';
import type { GalleryEntry } from './gallery-data.ts';
import { dateOf, nameOf, titleOf } from './painting-text.ts';

/**
 * One painting on the Atlas's wall: its picture at its own shape, its color strip under it, and a
 * museum label shown while it is pointed at. The whole tile links to the painting's page.
 */
export class PaintingTile {
  readonly element = document.createElement('a');
  /** The picture's width over its height. */
  readonly aspect: number;
  readonly #entry: GalleryEntry;
  readonly #picture = document.createElement('img');
  readonly #label = document.createElement('span');
  /** The standard width of the thumbnail asked for so far. */
  #thumbnailWidth = 0;

  constructor(entry: GalleryEntry) {
    this.#entry = entry;
    const { painting, artist, strip } = entry;
    this.aspect = painting.width / painting.height;
    this.element.className = 'painting-tile';
    this.element.href = `./painting.html?id=${painting.id}`;
    this.element.setAttribute('aria-label', `${titleOf(painting)}, ${nameOf(artist)}, ${dateOf(painting)}`);
    this.#picture.alt = '';
    this.#picture.loading = 'lazy';
    this.#picture.decoding = 'async';
    // Until the picture arrives, the middle of its strip stands in for it.
    const middle = Math.floor(strip.width / 2) * BYTES_PER_PIXEL;
    this.#picture.style.backgroundColor = `rgb(${strip.data[middle]} ${strip.data[middle + 1]} ${strip.data[middle + 2]})`;
    const band = imageCanvas(strip);
    band.className = 'tile-strip';
    this.#label.className = 'tile-label';
    this.#label.setAttribute('aria-hidden', 'true');
    const title = document.createElement('b');
    title.textContent = titleOf(painting);
    this.#label.append(title, `${nameOf(artist)}, ${dateOf(painting)}`);
    this.element.append(this.#picture, band, this.#label);
  }

  /** Sizes the picture, and asks Commons for a thumbnail sharp enough for it, if it hasn't one yet. */
  size(width: number, pictureHeight: number): void {
    this.element.style.width = `${width}px`;
    this.element.style.setProperty('--picture-height', `${pictureHeight}px`);
    const thumbnailWidth = thumbnailWidthAtLeast(Math.ceil(pictureHeight * this.aspect * devicePixelRatio));
    if (thumbnailWidth > this.#thumbnailWidth) {
      this.#thumbnailWidth = thumbnailWidth;
      this.#picture.src = this.#entry.image.url(thumbnailWidth);
    }
  }

  /**
   * Opens each tile's label over its middle, slid sideways just enough to stay within the sides of
   * `row` (the wall, say), so it stays on the page. Every tile is measured before any label moves,
   * so the page is laid out only once.
   */
  static keepLabelsWithin(tiles: readonly PaintingTile[], row: Element): void {
    const { left, right } = row.getBoundingClientRect();
    const shifts = tiles.map((tile) => [tile, tile.#labelShiftWithin(left, right)] as const);
    for (const [tile, shift] of shifts) tile.element.style.setProperty('--label-shift', `${shift}px`);
  }

  /** How far its label must slide from over its middle to stay between `left` and `right`, as laid out now. */
  #labelShiftWithin(left: number, right: number): number {
    const tile = this.element.getBoundingClientRect();
    const width = this.#label.offsetWidth;
    const centered = (tile.left + tile.right - width) / 2;
    // Where it can't fit between them (a phone's narrowest screens), its start stays in view.
    return Math.max(Math.min(centered, right - width), left) - centered;
  }
}
