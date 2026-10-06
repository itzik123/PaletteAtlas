import { BYTES_PER_PIXEL } from '@palette-atlas/color';
import { thumbnailWidthAtLeast } from '@palette-atlas/gallery';
import { imageCanvas } from '../image-adapters.ts';
import type { GalleryEntry } from './gallery-data.ts';
import { dateOf, nameOf, titleOf } from './painting-text.ts';

/** Where a tile sits in its row, so its label can stay within the wall. */
export type RowEdge = 'start' | 'end' | 'none';

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
    const label = document.createElement('span');
    label.className = 'tile-label';
    label.setAttribute('aria-hidden', 'true');
    const title = document.createElement('b');
    title.textContent = titleOf(painting);
    label.append(title, `${nameOf(artist)}, ${dateOf(painting)}`);
    this.element.append(this.#picture, band, label);
  }

  /** Sizes the picture, and asks Commons for a thumbnail sharp enough for it, if it hasn't one yet. */
  size(width: number, pictureHeight: number, edge: RowEdge): void {
    this.element.style.width = `${width}px`;
    this.element.style.setProperty('--picture-height', `${pictureHeight}px`);
    this.element.dataset.edge = edge;
    const thumbnailWidth = thumbnailWidthAtLeast(Math.ceil(pictureHeight * this.aspect * devicePixelRatio));
    if (thumbnailWidth > this.#thumbnailWidth) {
      this.#thumbnailWidth = thumbnailWidth;
      this.#picture.src = this.#entry.image.url(thumbnailWidth);
    }
  }
}
