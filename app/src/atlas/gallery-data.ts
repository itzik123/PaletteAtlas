import type { RgbaImage } from '@palette-atlas/color';
import {
  type Artist,
  type ChunkFiles,
  CommonsImage,
  type Columns,
  chunkOf,
  GALLERY_FILES,
  type GalleryManifest,
  idShard,
  nearestInRow,
  type Painting,
  PaintingMap,
  recordAt,
  stripInRow,
} from '@palette-atlas/gallery';
import { FetchedOnce, fetchGunzipped, fetchOk } from '../fetching.ts';
import { decodeImage } from '../image-adapters.ts';

/** Where the pipeline writes the gallery's data (app/public/data), as the site's pages see it. */
export const DATA_URL = './data/';

/** A painting of the gallery, with all a page needs to show it. */
export interface PaintingEntry {
  readonly painting: Painting;
  readonly artist: Artist;
  readonly image: CommonsImage;
  /** Its color strip, as the pipeline read it. */
  readonly strip: RgbaImage;
}

/** A painting at its place in the gallery. */
export interface GalleryEntry extends PaintingEntry {
  /** Its place in the gallery, the most famous first. */
  readonly position: number;
}

/** An artist's career: their paintings dated closely enough to place, in the order they made them (see careers). */
export interface Career {
  readonly artist: Artist;
  readonly paintings: readonly PaintingEntry[];
}

/** An artist with a career, and how many paintings it has. */
export interface Painter {
  readonly artist: Artist;
  readonly paintings: number;
}

/**
 * The gallery's data, fetched only as pages need it: the manifest at the start, then chunks of
 * paintings with their strips, in gallery order or in the order of the artists' careers, and of
 * their nearest paintings, and the shards of the paintings' ids and the list of every career's
 * length only to find what a page shows.
 *
 * Virtual Proxy: each file is fetched and decoded on first use, once, however many ask for it.
 */
export class GalleryData {
  readonly #url: string;
  readonly #manifest: GalleryManifest;
  readonly #gallery: PaintingChunks;
  readonly #careers: PaintingChunks;
  readonly #nearest = new FetchedOnce(async (chunk: number) =>
    new Uint8Array(await (await fetchOk(`${this.#url}${GALLERY_FILES.nearest.chunk(chunk)}`)).arrayBuffer()),
  );
  readonly #ids = new FetchedOnce((shard: number) => fetchJson<Readonly<Record<string, number>>>(`${this.#url}${GALLERY_FILES.ids.shard(shard)}`));
  #careerLengths: Promise<readonly number[]> | undefined;
  #map: Promise<PaintingMap> | undefined;

  private constructor(url: string, manifest: GalleryManifest) {
    this.#url = url;
    this.#manifest = manifest;
    this.#gallery = new PaintingChunks(url, GALLERY_FILES.gallery, manifest);
    this.#careers = new PaintingChunks(url, GALLERY_FILES.careers, manifest);
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
    const paintings = await this.#gallery.read(from, Math.min(from + count, this.count));
    return paintings.map((entry, index) => ({ ...entry, position: from + index }));
  }

  /** The painting at a position, one of the gallery's. */
  async entry(position: number): Promise<GalleryEntry> {
    const [entry] = await this.entries(position, 1);
    if (!entry) throw new RangeError(`The gallery has no painting ${position}`);
    return entry;
  }

  /** The painting with a Wikidata item, if the gallery has it: found in its shard of the ids. */
  async find(id: string): Promise<GalleryEntry | undefined> {
    const shard = idShard(id);
    const position = shard === undefined ? undefined : (await this.#ids.get(shard))[id];
    return position === undefined ? undefined : this.entry(position);
  }

  /**
   * The paintings nearest a painting's colors, by their positions, the nearest first: the first
   * NEAREST_COUNT of those the search index finds for its wall of matches, as the gallery stores them.
   */
  async nearest(position: number): Promise<readonly number[]> {
    const { chunk, row } = chunkOf(position, this.#manifest.chunkSize);
    return nearestInRow(await this.#nearest.get(chunk), row);
  }

  /** How many paintings each artist's career has, in the order of the manifest's artists (Painting.artist). */
  careerLengths(): Promise<readonly number[]> {
    this.#careerLengths ??= fetchJson<readonly number[]>(`${this.#url}${GALLERY_FILES.careerLengths}`);
    return this.#careerLengths;
  }

  /** Every artist with a career, the most famous first, with how many paintings their career has. */
  async painters(): Promise<Painter[]> {
    const lengths = await this.careerLengths();
    const { artists } = this.#manifest;
    return lengths.flatMap((paintings, artist) => (paintings > 0 ? [{ artist: recordAt(artists, artist), paintings }] : []));
  }

  /** Where the search index is (see GALLERY_FILES.searchIndex): ColorSearch reads it in a worker. */
  get searchIndexUrl(): string {
    return `${this.#url}${GALLERY_FILES.searchIndex}`;
  }

  /** The paintings on a map of their color schemes, each with its color (see PaintingMap), for the Lab. */
  paintingMap(): Promise<PaintingMap> {
    this.#map ??= fetchGunzipped(`${this.#url}${GALLERY_FILES.paintingMap}`).then(PaintingMap.fromBytes);
    return this.#map;
  }

  /** The career of the artist with a Wikidata item, if the gallery has the artist. */
  async career(id: string): Promise<Career | undefined> {
    const artist = this.#manifest.artists.id.indexOf(id);
    if (artist < 0) return undefined;
    const lengths = await this.careerLengths();
    // The careers lie one after another, in the order of the manifest's artists.
    const start = lengths.slice(0, artist).reduce((sum, length) => sum + length, 0);
    const paintings = await this.#careers.read(start, start + (lengths[artist] ?? 0));
    return { artist: recordAt(this.#manifest.artists, artist), paintings };
  }
}

/**
 * Paintings stored in chunks (see ChunkFiles), read a run at a time: the gallery's, or the
 * careers'.
 *
 * Virtual Proxy: each chunk is fetched and decoded on first use, once, however many ask for it.
 */
class PaintingChunks {
  readonly #url: string;
  readonly #files: ChunkFiles;
  readonly #manifest: GalleryManifest;
  readonly #chunks = new FetchedOnce((chunk: number) => this.#readChunk(chunk));

  constructor(url: string, files: ChunkFiles, manifest: GalleryManifest) {
    this.#url = url;
    this.#files = files;
    this.#manifest = manifest;
  }

  /** The paintings from `from` up to `end` (exclusive). */
  async read(from: number, end: number): Promise<PaintingEntry[]> {
    if (from >= end) return [];
    const { chunkSize } = this.#manifest;
    const first = chunkOf(from, chunkSize).chunk;
    const last = chunkOf(end - 1, chunkSize).chunk;
    const chunks = await Promise.all(Array.from({ length: last - first + 1 }, (_, index) => this.#chunks.get(first + index)));
    return chunks.flat().slice(from - first * chunkSize, end - first * chunkSize);
  }

  async #readChunk(chunk: number): Promise<PaintingEntry[]> {
    const [paintings, strips] = await Promise.all([
      fetchJson<Columns<Painting>>(`${this.#url}${this.#files.paintings(chunk)}`),
      fetchOk(`${this.#url}${this.#files.strips(chunk)}`).then(async (response) =>
        // The strips are data: their bytes are colors already, to be taken as they are.
        decodeImage(await response.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }),
      ),
    ]);
    return Array.from({ length: strips.height }, (_, row) => {
      const painting = recordAt(paintings, row);
      return {
        painting,
        artist: recordAt(this.#manifest.artists, painting.artist),
        image: new CommonsImage(painting.file, painting.hash, painting.width),
        strip: stripInRow(strips, row),
      };
    });
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  return (await fetchOk(url)).json() as Promise<T>;
}
