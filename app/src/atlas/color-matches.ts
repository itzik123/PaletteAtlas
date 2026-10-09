import type { RgbaImage } from '@palette-atlas/color';
import type { WallPaintings } from './atlas.ts';
import { ColorSearch } from './color-search.ts';
import type { GalleryData, GalleryEntry } from './gallery-data.ts';

/**
 * The gallery's paintings nearest some colors: the search index's answer (ColorSearch), read into
 * paintings from the gallery's data, for a wall or a row of them.
 */
export class ColorMatches {
  readonly #data: GalleryData;
  readonly #search: ColorSearch;

  constructor(data: GalleryData, search = new ColorSearch(data.searchIndexUrl)) {
    this.#data = data;
    this.#search = search;
  }

  /**
   * The `count` paintings nearest the colors, the nearest first, leaving out a painting searched by
   * its own colors (by its position). The search runs when they are first asked for.
   */
  of(colors: RgbaImage, count: number, leaveOut?: number): WallPaintings {
    return new FoundPaintings(this.#data, async () =>
      (await this.#search.nearest(colors, count + 1))
        .map(({ id }) => id)
        .filter((position) => position !== leaveOut)
        .slice(0, count),
    );
  }
}

/**
 * Paintings a search found, by their positions in the gallery, in the order found.
 *
 * Virtual Proxy: the search runs on the first request, once, and again after it fails.
 */
class FoundPaintings implements WallPaintings {
  readonly #data: GalleryData;
  readonly #find: () => Promise<readonly number[]>;
  #positions: Promise<readonly number[]> | undefined;

  constructor(data: GalleryData, find: () => Promise<readonly number[]>) {
    this.#data = data;
    this.#find = find;
  }

  async entries(from: number, count: number): Promise<GalleryEntry[]> {
    if (!this.#positions) {
      this.#positions = this.#find();
      this.#positions.catch(() => (this.#positions = undefined));
    }
    const positions = (await this.#positions).slice(from, from + count);
    return Promise.all(positions.map((position) => this.#data.entry(position)));
  }
}
