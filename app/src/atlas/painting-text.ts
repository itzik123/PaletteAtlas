import type { Artist, Painting } from '@palette-atlas/gallery';

// How the Atlas words a painting's details. Titles and names come from Wikidata, so pages put them
// in as text, never as markup.

export function titleOf(painting: Painting): string {
  return painting.title ?? 'Untitled';
}

export function nameOf(artist: Artist): string {
  return artist.name ?? 'Unknown artist';
}

/**
 * When a painting was made, as precisely as Wikidata knows it. Wikidata stores a decade as its
 * first year and a century or millennium as its last: 1500 with century precision is the 15th
 * century, as Wikidata itself shows it.
 */
export function dateOf({ year, precision }: Painting): string {
  if (year <= 0) return yearOf(year);
  switch (precision) {
    case 'decade':
      return `${Math.floor(year / 10) * 10}s`;
    case 'century':
      return `${ordinal(Math.ceil(year / 100))} century`;
    case 'millennium':
      return `${ordinal(Math.ceil(year / 1000))} millennium`;
    case 'year':
      return yearOf(year);
  }
}

/** Writes numbers as the Atlas does, e.g. 1,204. */
const NUMBERS = new Intl.NumberFormat('en');

/** How many paintings there are, in words, e.g. "1 painting" or "1,204 paintings". */
export function paintingCount(count: number): string {
  return `${NUMBERS.format(count)} ${count === 1 ? 'painting' : 'paintings'}`;
}

/** An artist's years, e.g. "1632–1675", or "d. 1675" when their birth isn't known. */
export function lifespanOf({ born, died }: Artist): string {
  return born === null ? `d. ${yearOf(died)}` : `${yearOf(born)}–${yearOf(died)}`;
}

/** Wikidata's years before the common era are negative, with no year 0. */
function yearOf(year: number): string {
  return year > 0 ? String(year) : `${-year} BC`;
}

function ordinal(count: number): string {
  const tens = count % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[count % 10] ?? 'th';
  return `${count}${suffix}`;
}
