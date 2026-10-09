import type { RgbaImage } from '@palette-atlas/color';
import type { Neighbor, SearchStep } from '@palette-atlas/hnsw';

// The messages between the page and the search worker (search-worker.ts). postMessage copies them
// by the structured clone algorithm, so they hold plain data only.

/** What every request to the worker carries. */
interface Request {
  readonly id: number;
  /** Where the search index is (see GALLERY_FILES.searchIndex): read on the first request, and kept. */
  readonly index: string;
}

/**
 * Asks for the paintings whose colors lie nearest a color strip's, as the Atlas hangs them
 * ('nearest'), or for that same search recorded step by step beside the exact answer, for the Lab
 * ('traced', see TracedSearch).
 */
interface ColorsRequest extends Request {
  readonly kind: 'nearest' | 'traced';
  /** A color strip, its segments in a row (see colorSchemeVector). */
  readonly colors: RgbaImage;
  readonly count: number;
}

/** Asks for the index's layers above the bottom one (see UpperLayers): for the Lab to draw. */
interface LayersRequest extends Request {
  readonly kind: 'layers';
}

export type SearchRequest = ColorsRequest | LayersRequest;

/** A search for a color strip, recorded as it ran, and the exact answer it is checked against. */
export interface TracedSearch {
  /** The strip's color scheme vector, which was searched for: the Lab places it on the map. */
  readonly vector: Float32Array;
  /** What the search found, the nearest first, as a NearestRequest is answered. */
  readonly found: readonly Neighbor[];
  /** Its steps, in the order it took them (see SearchRecorder). */
  readonly steps: readonly SearchStep[];
  /** As many nearest as it found, by brute force: measuring every painting. */
  readonly exact: readonly Neighbor[];
}

/**
 * The index's layers above the bottom one: each node's level, and on each layer from 1 up the
 * links of its nodes, which are, in id order, the nodes whose level reaches it: 31,539 links for the
 * gallery, while the bottom layer's 787,773 stay in the worker.
 */
export interface UpperLayers {
  readonly count: number;
  readonly entryPoint: number;
  readonly topLevel: number;
  readonly levels: Uint8Array;
  /** Layer 1 first: where each of its nodes' links start in `links`, and one more for where the last one's end. */
  readonly layers: readonly { readonly starts: Int32Array; readonly links: Int32Array }[];
}

/**
 * The worker's answer to the request with the same id, holding what the request's kind asked for,
 * or nothing if the index couldn't be read or the strip has no color: the paintings by their
 * positions in the gallery, the nearest first.
 */
export interface SearchResponse {
  readonly id: number;
  readonly found?: readonly Neighbor[];
  readonly traced?: TracedSearch;
  readonly layers?: UpperLayers;
}
