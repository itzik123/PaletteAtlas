import type { RgbaImage } from '@palette-atlas/color';
import type { Neighbor } from '@palette-atlas/hnsw';

// The messages between the page and the search worker (search-worker.ts). postMessage copies them
// by the structured clone algorithm, so they hold plain data only.

/** Asks the worker for the paintings whose colors lie nearest a color strip's. */
export interface SearchRequest {
  readonly id: number;
  /** Where the search index is (see GALLERY_FILES.searchIndex): read on the first request, and kept. */
  readonly index: string;
  /** A color strip, its segments in a row (see colorSchemeVector). */
  readonly colors: RgbaImage;
  readonly count: number;
}

/**
 * The worker's answer to the request with the same id: the paintings by their positions in the
 * gallery, the nearest first, or none if the index couldn't be read or the strip has no color.
 */
export interface SearchResponse {
  readonly id: number;
  readonly found?: readonly Neighbor[];
}
