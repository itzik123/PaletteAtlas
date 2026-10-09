import type { RgbaImage } from '@palette-atlas/color';
import type { Neighbor } from '@palette-atlas/hnsw';
import { IndexLayers } from '../lab/index-layers.ts';
import { WorkerChannel } from '../worker-channel.ts';
import type { SearchRequest, SearchResponse, TracedSearch } from '../workers/search-messages.ts';

/**
 * Finds the gallery's paintings whose colors lie nearest a color strip's, in its search index, in
 * a Web Worker: the index is read once, there, and the page never waits on it. For the Lab, it
 * also replays that very search step by step, and hands over the index's layers to draw.
 *
 * Remote Proxy: stands in for GallerySearch, which lives in the worker (search-worker.ts).
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
    const { found } = await this.#channel.ask((id) => ({ id, kind: 'nearest', index: this.#index, colors, count }));
    if (!found) throw new Error('The search failed');
    return found;
  }

  /**
   * The very search `nearest` runs for the colors, recorded step by step, beside the exact answer
   * (see TracedSearch): what the Lab replays. Fails as `nearest` does.
   */
  async traced(colors: RgbaImage, count: number): Promise<TracedSearch> {
    const { traced } = await this.#channel.ask((id) => ({ id, kind: 'traced', index: this.#index, colors, count }));
    if (!traced) throw new Error('The search failed');
    return traced;
  }

  /** The index's layers, which paintings live on each and how they link above the bottom one: what the Lab draws. */
  async layers(): Promise<IndexLayers> {
    const { layers } = await this.#channel.ask((id) => ({ id, kind: 'layers', index: this.#index }));
    if (!layers) throw new Error('The search index didn’t load');
    return new IndexLayers(layers);
  }
}
