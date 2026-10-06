import type { Artist } from '@palette-atlas/gallery';
import type { GalleryEntry } from '../atlas/gallery-data.ts';

/** Years in a decade. */
const DECADE = 10;
/** Where a painting dated only to a decade is placed in it: the decade's middle. */
const DECADE_MIDDLE = 5;

/** A painting placed in its artist's career. */
export interface CareerPainting {
  readonly entry: GalleryEntry;
  /** The year it is placed at: the year it was made, or the middle of its decade when Wikidata knows no closer. */
  readonly year: number;
}

/** A run of a career's paintings made within the same span of years. */
export interface Span {
  /** The span's first year. */
  readonly year: number;
  /** Its paintings: from `start` up to `end` (exclusive) in Career.paintings. */
  readonly start: number;
  readonly end: number;
}

/**
 * An artist's paintings in the order they were made, as the barcodes draw them: those dated to a
 * year or a decade within the artist's life. Paintings dated no closer than a century, or outside
 * the artist's life (a slip in Wikidata, or a work finished by others), have no place in it.
 */
export class Career {
  readonly artist: Artist;
  /** Oldest first; those of the same year in gallery order, the most famous first. */
  readonly paintings: readonly CareerPainting[];
  /** How many of the artist's paintings have no place in it. */
  readonly unplaced: number;

  /** From the artist's paintings, in gallery order. */
  constructor(artist: Artist, entries: readonly GalleryEntry[]) {
    this.artist = artist;
    const placed = entries.flatMap((entry) => {
      const year = placedYear(entry, artist);
      return year === undefined ? [] : [{ entry, year }];
    });
    // The sort is stable, so the paintings of a year keep the gallery's order.
    this.paintings = placed.sort((a, b) => a.year - b.year);
    this.unplaced = entries.length - placed.length;
  }

  /** The year of its first painting. */
  get first(): number {
    return this.paintings[0]?.year ?? this.artist.died;
  }

  /** The year of its last painting. */
  get last(): number {
    return this.paintings.at(-1)?.year ?? this.artist.died;
  }

  /** Its paintings in spans of `years` years, each starting at a multiple of `years`: only the spans with paintings. */
  spans(years: number): Span[] {
    const spans: { year: number; start: number; end: number }[] = [];
    this.paintings.forEach(({ year }, index) => {
      const spanYear = Math.floor(year / years) * years;
      const last = spans.at(-1);
      if (last?.year === spanYear) last.end = index + 1;
      else spans.push({ year: spanYear, start: index, end: index + 1 });
    });
    return spans;
  }
}

/**
 * The year a painting is placed at in its artist's career, if it has a place there. A decade
 * shows as "the 1880s" whatever its year in Wikidata, so its paintings are placed in its middle.
 */
function placedYear({ painting }: GalleryEntry, { born, died }: Artist): number | undefined {
  let year: number;
  if (painting.precision === 'year') year = painting.year;
  else if (painting.precision === 'decade') year = Math.floor(painting.year / DECADE) * DECADE + DECADE_MIDDLE;
  else return undefined;
  return year > died || (born !== null && year < born) ? undefined : year;
}
