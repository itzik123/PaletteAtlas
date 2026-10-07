import type { RgbaImage } from '@palette-atlas/color';
import { HnswIndex } from '@palette-atlas/hnsw';
import { colorSchemeDistance, colorSchemeVector } from '@palette-atlas/vectorize';
import type { GalleryData } from '../atlas/gallery-data.ts';
import { titleOf } from '../atlas/painting-text.ts';
import { imageCanvas } from '../image-adapters.ts';

/** How many of the nearest paintings each image shows. */
const SHOWN = 6;
/** The thumbnails' width in CSS pixels, at most; Commons serves the next standard width up. */
const THUMBNAIL_WIDTH = 120;

/**
 * The gallery's paintings nearest an image's color strip, found in the site's own search index as
 * the browser reads it: the benchmark page's check of the pipeline's index. The index loads once,
 * on first use, for every image.
 */
export class NearestPaintings {
  readonly #gallery: Promise<GalleryData>;
  #index: Promise<HnswIndex> | undefined;

  constructor(gallery: Promise<GalleryData>) {
    this.#gallery = gallery;
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
    this.#index ??= gallery.searchIndex().then((bytes) => HnswIndex.fromBytes(bytes, { distance: colorSchemeDistance }));
    const found = (await this.#index).search(colorSchemeVector(strip), SHOWN);
    const entries = await Promise.all(found.map(async ({ id }) => (await gallery.entries(id, 1))[0]));
    element.replaceChildren(
      ...entries.map((entry, index) => {
        const figure = document.createElement('figure');
        const picture = document.createElement('img');
        picture.alt = '';
        picture.src = entry.image.urlAtLeast(THUMBNAIL_WIDTH * devicePixelRatio);
        const caption = document.createElement('figcaption');
        caption.textContent = `${found[index].distance.toFixed(3)} · ${titleOf(entry.painting)}`;
        caption.title = titleOf(entry.painting);
        figure.append(picture, imageCanvas(entry.strip), caption);
        return figure;
      }),
    );
  }
}
