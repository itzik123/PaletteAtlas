/**
 * How many files the paintings' Wikidata items are spread over (see GALLERY_FILES.ids): about 760
 * each, 5 KB gzipped, so a page finds its painting without all 48,695 (210 KB, Oct 11, 2026).
 */
export const ID_SHARDS = 64;

/** The shard of the ids a Wikidata item lies in, by its number, or none for what is no item's id. */
export function idShard(id: string): number | undefined {
  const item = /^Q(\d+)$/.exec(id);
  return item ? Number(item[1]) % ID_SHARDS : undefined;
}
