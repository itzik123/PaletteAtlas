/**
 * Records stored field by field: one array per field, record i's value at index i of each. As
 * JSON this names each field once rather than once per record, which more than halves the
 * paintings' files.
 */
export type Columns<T> = { readonly [Field in keyof T]: readonly T[Field][] };

/** Stores records field by field; the fields are listed so that even no records keep every column. */
export function columnsOf<T>(records: readonly T[], fields: readonly (keyof T)[]): Columns<T> {
  return Object.fromEntries(fields.map((field) => [field, records.map((record) => record[field])])) as unknown as Columns<T>;
}

/** The record at an index, put back together from its fields. */
export function recordAt<T>(columns: Columns<T>, index: number): T {
  return Object.fromEntries(Object.entries<readonly unknown[]>(columns).map(([field, values]) => [field, values[index]])) as T;
}

export function recordCount<T>(columns: Columns<T>): number {
  return Object.values<readonly unknown[]>(columns)[0]?.length ?? 0;
}
