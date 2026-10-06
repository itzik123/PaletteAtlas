import type { Columns } from './columns.ts';
import type { ThumbnailWidth } from './commons-image.ts';

// The gallery's data as the pipeline writes it (pnpm paintings) and the site reads it, in
// app/public/data:
//
//   gallery.json            the manifest: GalleryManifest, with every artist
//   ids.json                every painting's Wikidata item, in gallery order, to find one by it
//   paintings/<k>.json      chunk k of the paintings in gallery order, as Columns<Painting>
//   strips/<k>.png          their color strips, a row each (see packStrips)
//   careers.json            how many paintings each artist's career has, in the manifest's order
//   careers/<k>.json        chunk k of the careers (see careers), artist after artist in that order
//   career-strips/<k>.png   their color strips

/**
 * Paintings stored in chunks of GalleryManifest.chunkSize (see chunkOf): a file of their records
 * and an image of their color strips per chunk.
 */
export interface ChunkFiles {
  /** Chunk k's paintings, as Columns<Painting>. */
  readonly paintings: (chunk: number) => string;
  /** Chunk k's color strips, a row each (see packStrips). */
  readonly strips: (chunk: number) => string;
  /** The folders that hold the chunks. */
  readonly folders: readonly string[];
}

function chunkFiles(paintingsFolder: string, stripsFolder: string): ChunkFiles {
  return {
    paintings: (chunk) => `${paintingsFolder}/${chunk}.json`,
    strips: (chunk) => `${stripsFolder}/${chunk}.png`,
    folders: [paintingsFolder, stripsFolder],
  };
}

/** The gallery's files, relative to its data folder. */
export const GALLERY_FILES = {
  manifest: 'gallery.json',
  ids: 'ids.json',
  /** The paintings in gallery order, the most famous first. */
  gallery: chunkFiles('paintings', 'strips'),
  /** How many paintings each artist's career has, in the order of the manifest's artists. */
  careerLengths: 'careers.json',
  /**
   * The artists' careers (see careers), one after another in the order of the manifest's artists:
   * an artist's page loads their paintings in the order they made them from a chunk or two,
   * rather than from every chunk of the gallery.
   */
  careers: chunkFiles('careers', 'career-strips'),
} as const;

/**
 * The width of the Commons image each painting's strip was read from (the fetch step downloads
 * it), so the site reads the same strips from the same file.
 */
export const SOURCE_WIDTH: ThumbnailWidth = 500;

export interface GalleryManifest {
  /** The day the catalog was compiled, as an ISO date. */
  readonly created: string;
  /** How many paintings the gallery has. */
  readonly count: number;
  /** Paintings per chunk (see chunkOf). */
  readonly chunkSize: number;
  /** Segments per strip. */
  readonly segments: number;
  /** Every artist, in the order of their first painting in the gallery: the most famous first. */
  readonly artists: Columns<Artist>;
}

export interface Artist {
  /** Their Wikidata item, e.g. Q762. */
  readonly id: string;
  readonly name: string | null;
  readonly born: number | null;
  readonly died: number;
}

/** How precisely a painting's year is known. */
export type DatePrecision = 'year' | 'decade' | 'century' | 'millennium';

/** The license of a painting's image on Commons: public domain, or CC0. */
export type License = 'pd' | 'cc0';

export interface Painting {
  /** Its Wikidata item, e.g. Q12418. */
  readonly id: string;
  readonly title: string | null;
  /** Its artist's index in GalleryManifest.artists. */
  readonly artist: number;
  /** The year it was made, as precise as `precision` says. */
  readonly year: number;
  readonly precision: DatePrecision;
  /** The museum or collection that holds it, if Wikidata names it. */
  readonly collection: string | null;
  /** Its image on Commons (see CommonsImage): the file's name, hash and full size, and its license. */
  readonly file: string;
  readonly hash: string;
  readonly width: number;
  readonly height: number;
  readonly license: License;
}

/** The fields of the records, in the order the files list them. */
export const ARTIST_FIELDS: readonly (keyof Artist)[] = ['id', 'name', 'born', 'died'];
export const PAINTING_FIELDS: readonly (keyof Painting)[] = [
  'id',
  'title',
  'artist',
  'year',
  'precision',
  'collection',
  'file',
  'hash',
  'width',
  'height',
  'license',
];
