import { HnswIndex } from '@palette-atlas/hnsw';
import { colorSchemeDistance } from '@palette-atlas/vectorize';
import { fetchGunzipped } from '../fetching.ts';
import { GallerySearch } from './gallery-search.ts';
import type { SearchRequest, SearchResponse } from './search-messages.ts';

// A Web Worker that holds the gallery's search index and answers what the page asks of it (see
// GallerySearch). Unzipping and reading the index take a moment, once, away from the page's main
// thread; every search after that takes about a millisecond.

/** The gallery's searches, their index read on the first request. */
let searches: Promise<GallerySearch> | undefined;

self.addEventListener('message', async ({ data }: MessageEvent<SearchRequest>) => {
  try {
    const [response, transfer] = answer(await searchesAt(data.index), data);
    postMessage(response, transfer);
  } catch (error) {
    console.error(error);
    postMessage({ id: data.id } satisfies SearchResponse);
  }
});

/** The answer to a request, and the arrays it hands the page rather than copying them. */
function answer(search: GallerySearch, request: SearchRequest): [SearchResponse, Transferable[]] {
  const { id } = request;
  switch (request.kind) {
    case 'nearest':
      return [{ id, found: search.nearest(request.colors, request.count) }, []];
    case 'traced': {
      const traced = search.traced(request.colors, request.count);
      return [{ id, traced }, [traced.vector.buffer]];
    }
    case 'layers': {
      const layers = search.upperLayers();
      return [{ id, layers }, [layers.levels.buffer, ...layers.layers.flatMap(({ starts, links }) => [starts.buffer, links.buffer])]];
    }
  }
}

function searchesAt(url: string): Promise<GallerySearch> {
  if (!searches) {
    searches = read(url);
    // An index that fails to arrive is asked for again next time.
    searches.catch(() => (searches = undefined));
  }
  return searches;
}

async function read(url: string): Promise<GallerySearch> {
  return new GallerySearch(HnswIndex.fromBytes(await fetchGunzipped(url), { distance: colorSchemeDistance }));
}
