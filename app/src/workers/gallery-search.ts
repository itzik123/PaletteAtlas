import type { RgbaImage } from '@palette-atlas/color';
import { BruteForceIndex, type HnswIndex, type Neighbor, SearchRecorder } from '@palette-atlas/hnsw';
import { colorSchemeDistance, colorSchemeVector } from '@palette-atlas/vectorize';
import type { TracedSearch, UpperLayers } from './search-messages.ts';

/**
 * The gallery's search index and what the site asks of it (in the search worker, which only passes
 * the messages on): the paintings nearest a color strip's colors, for the Atlas; that very search
 * recorded step by step beside the exact answer, and the index's layers above the bottom one, for
 * the Lab to draw.
 */
export class GallerySearch {
  readonly #index: HnswIndex;
  readonly #exact: BruteForceIndex;

  constructor(index: HnswIndex) {
    this.#index = index;
    this.#exact = new BruteForceIndex(index.vectors, colorSchemeDistance);
  }

  /** The `count` paintings nearest the colors, by their positions in the gallery, the nearest first. */
  nearest(colors: RgbaImage, count: number): Neighbor[] {
    return this.#index.search(colorSchemeVector(colors), count);
  }

  /** The search `nearest` runs, recorded as it runs (which leaves what it finds unchanged), and the exact answer. */
  traced(colors: RgbaImage, count: number): TracedSearch {
    const vector = colorSchemeVector(colors);
    const recorder = new SearchRecorder();
    const found = this.#index.search(vector, count, { tracer: recorder });
    return { vector, found, steps: recorder.steps, exact: this.#exact.search(vector, count) };
  }

  /** The index's layers above the bottom one: its nodes' levels, and each upper layer's links. */
  upperLayers(): UpperLayers {
    const { graph } = this.#index;
    const levels = Uint8Array.from({ length: graph.count }, (_, node) => graph.levelOf(node));
    const layers = Array.from({ length: Math.max(0, graph.topLevel) }, (_, below) => {
      const level = below + 1;
      const starts = [0];
      const links: number[] = [];
      for (let node = 0; node < graph.count; node++) {
        if (levels[node] < level) continue;
        links.push(...graph.neighbors(node, level));
        starts.push(links.length);
      }
      return { starts: Int32Array.from(starts), links: Int32Array.from(links) };
    });
    return { count: graph.count, entryPoint: graph.entryPoint, topLevel: graph.topLevel, levels, layers };
  }
}
