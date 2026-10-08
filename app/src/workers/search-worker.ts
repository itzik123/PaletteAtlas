import { HnswIndex, type Neighbor } from '@palette-atlas/hnsw';
import { colorSchemeDistance, colorSchemeVector } from '@palette-atlas/vectorize';
import { fetchGunzipped } from '../gunzip.ts';
import type { SearchRequest, SearchResponse } from './search-messages.ts';

// A Web Worker that holds the gallery's search index and finds the paintings nearest a color strip
// in it. Unzipping and reading the index take a moment, once, away from the page's main thread;
// every search after that takes about a millisecond.

/** The index, read on the first request. */
let index: Promise<HnswIndex> | undefined;

self.addEventListener('message', async ({ data }: MessageEvent<SearchRequest>) => {
  const found = await search(data).catch((error: unknown) => {
    console.error(error);
    return undefined;
  });
  postMessage({ id: data.id, found } satisfies SearchResponse);
});

async function search({ index: url, colors, count }: SearchRequest): Promise<Neighbor[]> {
  return (await indexAt(url)).search(colorSchemeVector(colors), count);
}

function indexAt(url: string): Promise<HnswIndex> {
  if (!index) {
    index = read(url);
    // An index that fails to arrive is asked for again next time.
    index.catch(() => (index = undefined));
  }
  return index;
}

async function read(url: string): Promise<HnswIndex> {
  return HnswIndex.fromBytes(await fetchGunzipped(url), { distance: colorSchemeDistance });
}
