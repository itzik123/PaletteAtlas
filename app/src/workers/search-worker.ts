import { HnswIndex, type Neighbor } from '@palette-atlas/hnsw';
import { colorSchemeDistance, colorSchemeVector } from '@palette-atlas/vectorize';
import type { SearchRequest, SearchResponse } from './search-messages.ts';

// A Web Worker that holds the gallery's search index and finds the paintings nearest a color strip
// in it. Unzipping and reading the index take a moment, once, away from the page's main thread;
// every search after that takes about a millisecond.

/** The first two bytes of a gzipped file. */
const GZIP_MAGIC = [0x1f, 0x8b] as const;

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
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return HnswIndex.fromBytes(await gunzipped(new Uint8Array(await response.arrayBuffer())), { distance: colorSchemeDistance });
}

/**
 * A gzipped file's bytes unzipped (see GALLERY_FILES.searchIndex), or the bytes as they are where
 * the host served it as gzip-encoded and the browser has unzipped it already.
 */
async function gunzipped(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  if (bytes[0] !== GZIP_MAGIC[0] || bytes[1] !== GZIP_MAGIC[1]) return bytes;
  const unzipped = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(unzipped).arrayBuffer());
}
