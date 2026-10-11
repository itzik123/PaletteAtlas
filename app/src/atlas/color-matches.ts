import type { RgbaImage } from '@palette-atlas/color';
import { MATCHES, NEAREST_COUNT } from '@palette-atlas/gallery';
import type { WallPaintings } from './atlas.ts';
import { ColorSearch } from './color-search.ts';
import type { GalleryData, GalleryEntry } from './gallery-data.ts';

/**
 * The gallery's paintings nearest some colors: the search index's answer (ColorSearch), read into
 * paintings from the gallery's data, for a wall or a row of them; for a painting's own colors, the
 * first of them as the gallery stores them, without the index.
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

  /**
   * The MATCHES paintings nearest a painting's colors, as `of` finds them for its strip, leaving it
   * out: the first NEAREST_COUNT as the gallery stores them (see GalleryData.nearest), and the rest
   * from the search, which downloads the index only once they are asked for.
   */
  like({ strip, position }: GalleryEntry): WallPaintings {
    return new NearestFirst(this.#data, position, this.of(strip, MATCHES, position));
  }
}

/** A painting's nearest paintings: the first page as the gallery stores them, and the rest as found. */
class NearestFirst implements WallPaintings {
  readonly #data: GalleryData;
  readonly #position: number;
  readonly #found: WallPaintings;

  constructor(data: GalleryData, position: number, found: WallPaintings) {
    this.#data = data;
    this.#position = position;
    this.#found = found;
  }

  async entries(from: number, count: number): Promise<GalleryEntry[]> {
    if (from + count > NEAREST_COUNT) return this.#found.entries(from, count);
    const positions = (await this.#data.nearest(this.#position)).slice(from, from + count);
    return Promise.all(positions.map((position) => this.#data.entry(position)));
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
