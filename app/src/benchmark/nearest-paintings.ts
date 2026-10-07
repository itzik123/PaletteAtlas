import type { RgbaImage } from '@palette-atlas/color';
import { ColorSearch } from '../atlas/color-search.ts';
import type { GalleryData } from '../atlas/gallery-data.ts';
import { titleOf } from '../atlas/painting-text.ts';
import { imageCanvas } from '../image-adapters.ts';

/** How many of the nearest paintings each image shows. */
const SHOWN = 6;
/** The thumbnails' width in CSS pixels, at most; Commons serves the next standard width up. */
const THUMBNAIL_WIDTH = 120;

/**
 * The gallery's paintings nearest an image's color strip, found in the site's own search index as
 * the site searches it, in a worker (ColorSearch): the benchmark page's check of the index. The
 * index loads once, on first use, for every image.
 */
export class NearestPaintings {
  readonly #gallery: Promise<GalleryData>;
  readonly #search: Promise<ColorSearch>;

  constructor(gallery: Promise<GalleryData>) {
    this.#gallery = gallery;
    this.#search = gallery.then((data) => new ColorSearch(data.searchIndexUrl));
  }

  /** An element that fills with the paintings nearest the strip, each with its own strip and distance. */
  view(strip: RgbaImage): HTMLElement {
    const element = document.createElement('div');
    element.className = 'nearest';
    element.textContent = 'Loading the search index…';
    void this.#fill(element, strip).catch((error: unknown) => {
      element.textContent = `No search index: run pnpm search-index (${String(error)})`;
    });
    return element;
  }

  async #fill(element: HTMLElement, strip: RgbaImage): Promise<void> {
    const gallery = await this.#gallery;
    const found = await (await this.#search).nearest(strip, SHOWN);
    const entries = (await Promise.all(found.map(({ id }) => gallery.entries(id, 1)))).flat();
    element.replaceChildren(
      ...entries.map((entry, index) => {
        const figure = document.createElement('figure');
        const picture = document.createElement('img');
        picture.alt = '';
        picture.src = entry.image.urlAtLeast(THUMBNAIL_WIDTH * devicePixelRatio);
        const caption = document.createElement('figcaption');
        caption.textContent = `${found[index]?.distance.toFixed(3)} · ${titleOf(entry.painting)}`;
        caption.title = titleOf(entry.painting);
        figure.append(picture, imageCanvas(entry.strip), caption);
        return figure;
      }),
    );
  }
}
