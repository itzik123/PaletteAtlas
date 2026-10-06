import type { Artist, Painting } from './gallery-files.ts';

/** Years in a decade. */
const DECADE = 10;
/** Where a painting dated only to a decade is placed in it: its middle. */
const DECADE_MIDDLE = 5;

/**
 * The year a painting is placed at in its artist's career, if it has a place there: the year it
 * was made, or the middle of its decade when Wikidata knows no closer (the site shows a decade as
 * "the 1880s", whatever year Wikidata stores in it). A painting dated no closer than a century, or
 * outside the artist's life (a slip in Wikidata, or a work finished by others), has none.
 */
export function placedYear({ year, precision }: Painting, { born, died }: Artist): number | undefined {
  let placed: number;
  if (precision === 'year') placed = year;
  else if (precision === 'decade') placed = Math.floor(year / DECADE) * DECADE + DECADE_MIDDLE;
  else return undefined;
  return placed > died || (born !== null && placed < born) ? undefined : placed;
}

/**
 * Every artist's career, in the order of `artists`: the positions in `paintings` of their paintings
 * that have a place in it (see placedYear), in the order they were made; those of the same year
 * keep the gallery's order, the most famous first.
 */
export function careers(paintings: readonly Painting[], artists: readonly Artist[]): number[][] {
  const placed = artists.map((): { position: number; year: number }[] => []);
  paintings.forEach((painting, position) => {
    const year = placedYear(painting, artists[painting.artist]);
    if (year !== undefined) placed[painting.artist].push({ position, year });
  });
  // The sort is stable, so the paintings of a year keep the gallery's order.
  return placed.map((career) => career.sort((a, b) => a.year - b.year).map(({ position }) => position));
}
