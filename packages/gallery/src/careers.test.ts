import { describe, expect, it } from 'vitest';
import { careers, placedYear } from './careers.ts';
import type { Artist, DatePrecision, Painting } from './gallery-files.ts';

const MONET: Artist = { id: 'Q296', name: 'Claude Monet', born: 1840, died: 1926 };
const UNBORN: Artist = { id: 'Q1', name: 'Master of the Altarpiece', born: null, died: 1500 };
const VAGUE: Artist = { id: 'Q2', name: 'Painter of Icons', born: 1600, died: 1660 };

/** A painting by the artist at an index, made in a year as precise as `precision`. */
function painting(artist: number, year: number, precision: DatePrecision = 'year'): Painting {
  return {
    id: `Q${artist}${year}`,
    title: null,
    artist,
    year,
    precision,
    collection: null,
    file: 'Painting.jpg',
    hash: '00',
    width: 1,
    height: 1,
    license: 'pd',
  };
}

describe('careers', () => {
  it('places a painting at its year, or in the middle of its decade', () => {
    expect(placedYear(painting(0, 1872), MONET)).toBe(1872);
    expect(placedYear(painting(0, 1880, 'decade'), MONET)).toBe(1885);
    // Wikidata may store any year of the decade; the site shows it as the 1880s all the same.
    expect(placedYear(painting(0, 1887, 'decade'), MONET)).toBe(1885);
  });

  it('gives no place to a painting dated no closer than a century, or outside its artist’s life', () => {
    expect(placedYear(painting(0, 1900, 'century'), MONET)).toBeUndefined();
    expect(placedYear(painting(0, 2000, 'millennium'), MONET)).toBeUndefined();
    expect(placedYear(painting(0, 1838), MONET)).toBeUndefined();
    expect(placedYear(painting(0, 1927), MONET)).toBeUndefined();
    expect(placedYear(painting(0, 1926), MONET)).toBe(1926);
    // With no year of birth known, only the year of death bounds the career.
    expect(placedYear(painting(1, 1300), UNBORN)).toBe(1300);
  });

  it('lists each artist’s paintings in the order they were made, those of the same year in gallery order', () => {
    const paintings = [
      painting(0, 1890),
      painting(1, 1450),
      painting(0, 1880, 'decade'),
      painting(0, 1885),
      painting(0, 1900, 'century'),
      painting(2, 1600, 'century'),
      painting(1, 1400, 'decade'),
      painting(0, 1870),
    ];
    expect(careers(paintings, [MONET, UNBORN, VAGUE])).toEqual([[7, 2, 3, 0], [6, 1], []]);
  });
});
