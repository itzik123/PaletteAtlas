import { readFile } from 'node:fs/promises';
import type { DatePrecision, License } from '@palette-atlas/gallery';

// The fetch step's catalog (works.json, written by pipeline/fetch/catalog.py): the contract
// between the two steps. Its fields mirror the Python dataclasses Work and Artist.

/** A painting in the catalog. */
export interface Work {
  /** Its Wikidata item, e.g. Q45585. */
  readonly id: string;
  /** Its title in the first language it has one in (English first), if any. */
  readonly title: string | null;
  /** Its artist's Wikidata item, a key of Catalog.artists. */
  readonly artist: string;
  /** The year it was made, as precise as `precision` says. */
  readonly year: number;
  readonly precision: DatePrecision;
  /** The museum or collection that holds it now, if Wikidata names it. */
  readonly collection: string | null;
  /** In how many Wikimedia projects (mostly Wikipedias) it has an article. */
  readonly sitelinks: number;
  /** Its image's file name on Wikimedia Commons, and the file's license there: `pd` or `cc0`. */
  readonly file: string;
  readonly license: License;
  /** The full size of the image on Commons. */
  readonly width: number;
  readonly height: number;
  /** The link its image was downloaded from: a 500 px wide Commons thumbnail. */
  readonly thumbnail: string;
  /** Its downloaded image, relative to the catalog's folder. */
  readonly image: string;
}

export interface Artist {
  readonly name: string | null;
  readonly born: number | null;
  readonly died: number;
}

export interface Catalog {
  readonly source: string;
  /** The day the catalog was compiled, as an ISO date. */
  readonly created: string;
  /** The paintings, the most famous first. */
  readonly works: readonly Work[];
  /** The artists, by Wikidata item. */
  readonly artists: Readonly<Record<string, Artist>>;
}

/** The catalog file of the folder the fetch step writes to. */
export const CATALOG_FILE = 'works.json';

export async function readCatalog(path: string): Promise<Catalog> {
  return JSON.parse(await readFile(path, 'utf8')) as Catalog;
}
