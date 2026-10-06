import { describe, expect, it } from 'vitest';
import { columnsOf, recordAt, recordCount } from './columns.ts';

interface Work {
  readonly title: string | null;
  readonly year: number;
}

const WORKS: readonly Work[] = [
  { title: 'Mona Lisa', year: 1503 },
  { title: null, year: 1650 },
  { title: 'The Starry Night', year: 1889 },
];

describe('columns', () => {
  it('stores records field by field and gives each one back as it was', () => {
    const columns = columnsOf(WORKS, ['title', 'year']);
    expect(columns).toEqual({ title: ['Mona Lisa', null, 'The Starry Night'], year: [1503, 1650, 1889] });
    expect(recordCount(columns)).toBe(3);
    expect(WORKS.map((_, index) => recordAt(columns, index))).toEqual(WORKS);
  });

  it('keeps every field even with no records', () => {
    expect(columnsOf<Work>([], ['title', 'year'])).toEqual({ title: [], year: [] });
  });
});
