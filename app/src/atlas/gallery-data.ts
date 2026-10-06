import type { RgbaImage } from '@palette-atlas/color';
import {
  type Artist,
  CommonsImage,
  type Columns,
  chunkOf,
  GALLERY_FILES,
  type GalleryManifest,
  type Painting,
  recordAt,
  stripInRow,
} from '@palette-atlas/gallery';
import { decodeImage } from '../image-adapters.ts';

/** Where the pipeline writes the gallery's data (app/public/data), as the site's pages see it. */
export const DATA_URL = './data/';

/** A painting of the gallery, with all a page needs to show it. */
export interface GalleryEntry {
  /** Its place in the gallery, the most famous first. */
  readonly position: number;
  readonly painting: Painting;
  readonly artist: Artist;
  readonly image: CommonsImage;
  /** Its color strip, as the pipeline read it. */
  readonly strip: RgbaImage;
}

/**
 * The gallery's data, fetched only as pages need it: the manifest at the start, then chunks of
 * paintings with their strips, and the list of every painting's id only to find one by it.
 *
 * Virtual Proxy: each file is fetched and decoded on first use, once, however many ask for it.
 */
export class GalleryData {
  readonly #url: string;
  readonly #manifest: GalleryManifest;
  readonly #chunks = new Map<number, Promise<GalleryEntry[]>>();
  #ids: Promise<readonly string[]> | undefined;

  private constructor(url: string, manifest: GalleryManifest) {
    this.#url = url;
    this.#manifest = manifest;
  }

  /** Fetches the gallery's manifest. */
  static async load(url = DATA_URL): Promise<GalleryData> {
    return new GalleryData(url, await fetchJson<GalleryManifest>(`${url}${GALLERY_FILES.manifest}`));
  }

  /** How many paintings the gallery has. */
  get count(): number {
    return this.#manifest.count;
  }

  /** The paintings from a position on, up to `count` of them. */
  async entries(from: number, count: number): Promise<GalleryEntry[]> {
    const { chunkSize } = this.#manifest;
    const end = Math.min(from + count, this.count);
    if (from >= end) return [];
    const first = chunkOf(from, chunkSize).chunk;
    const last = chunkOf(end - 1, chunkSize).chunk;
    const chunks = await Promise.all(Array.from({ length: last - first + 1 }, (_, index) => this.#chunk(first + index)));
    return chunks.flat().slice(from - first * chunkSize, end - first * chunkSize);
  }

  /** The painting with a Wikidata item, if the gallery has it. */
  async find(id: string): Promise<GalleryEntry | undefined> {
    this.#ids ??= fetchJson<readonly string[]>(`${this.#url}${GALLERY_FILES.ids}`);
    const position = (await this.#ids).indexOf(id);
    return position < 0 ? undefined : (await this.entries(position, 1))[0];
  }

  #chunk(chunk: number): Promise<GalleryEntry[]> {
    let entries = this.#chunks.get(chunk);
    if (!entries) {
      entries = this.#readChunk(chunk);
      this.#chunks.set(chunk, entries);
      // A chunk that fails to arrive is asked for again next time.
      entries.catch(() => this.#chunks.delete(chunk));
    }
    return entries;
  }

  async #readChunk(chunk: number): Promise<GalleryEntry[]> {
    const [paintings, strips] = await Promise.all([
      fetchJson<Columns<Painting>>(`${this.#url}${GALLERY_FILES.paintings(chunk)}`),
      fetchOk(`${this.#url}${GALLERY_FILES.strips(chunk)}`).then(async (response) =>
        // The strips are data: their bytes are colors already, to be taken as they are.
        decodeImage(await response.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }),
      ),
    ]);
    return Array.from({ length: strips.height }, (_, row) => {
      const painting = recordAt(paintings, row);
      return {
        position: chunk * this.#manifest.chunkSize + row,
        painting,
        artist: recordAt(this.#manifest.artists, painting.artist),
        image: new CommonsImage(painting.file, painting.hash, painting.width),
        strip: stripInRow(strips, row),
      };
    });
  }
}

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response;
}

async function fetchJson<T>(url: string): Promise<T> {
  return (await fetchOk(url)).json() as Promise<T>;
}
