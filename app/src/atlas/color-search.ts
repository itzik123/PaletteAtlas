import type { RgbaImage } from '@palette-atlas/color';
import type { Neighbor } from '@palette-atlas/hnsw';
import { WorkerChannel } from '../worker-channel.ts';
import type { SearchRequest, SearchResponse } from '../workers/search-messages.ts';

/**
 * Finds the gallery's paintings whose colors lie nearest a color strip's, in its search index, in
 * a Web Worker: the index is read once, there, and the page never waits on it.
 *
 * Remote Proxy: stands in for the HnswIndex, which lives in the worker (search-worker.ts).
 */
export class ColorSearch {
  /** The search index's address, absolute: a worker resolves relative ones against its own script. */
  readonly #index: string;
  readonly #channel = new WorkerChannel<SearchRequest, SearchResponse>(
    () => new Worker(new URL('../workers/search-worker.ts', import.meta.url), { type: 'module' }),
    (id) => ({ id }),
  );

  constructor(index: string) {
    this.#index = new URL(index, location.href).href;
  }

  /**
   * The `count` paintings nearest the colors, by their positions in the gallery, the nearest first.
   * Fails if the index can't be read, or the strip has no color at all.
   */
  async nearest(colors: RgbaImage, count: number): Promise<readonly Neighbor[]> {
    const { found } = await this.#channel.ask((id) => ({ id, index: this.#index, colors, count }));
    if (!found) throw new Error('The search failed');
    return found;
  }
}
