import type { Columns } from './columns.ts';
import type { ThumbnailWidth } from './commons-image.ts';

// The gallery's data as the pipeline writes it (pnpm paintings) and the site reads it, in
// app/public/data:
//
//   gallery.json          the manifest: GalleryManifest, with every artist
//   ids.json              every painting's Wikidata item, in gallery order, to find one by it
//   paintings/<k>.json    chunk k's paintings, as Columns<Painting>
//   strips/<k>.png        chunk k's color strips, a row each (see packStrips)

const PAINTINGS_FOLDER = 'paintings';
const STRIPS_FOLDER = 'strips';

/** The gallery's files, relative to its data folder. */
export const GALLERY_FILES = {
  manifest: 'gallery.json',
  ids: 'ids.json',
  paintings: (chunk: number): string => `${PAINTINGS_FOLDER}/${chunk}.json`,
  strips: (chunk: number): string => `${STRIPS_FOLDER}/${chunk}.png`,
  /** The folders that hold the chunks. */
  folders: [PAINTINGS_FOLDER, STRIPS_FOLDER],
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
