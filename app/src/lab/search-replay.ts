import type { SearchStep } from '@palette-atlas/hnsw';

/** What a search had done on one layer by some step of its record. */
export interface LayerWork {
  /** Each painting it measured on the layer, and how far it lies from the query. */
  readonly measured: ReadonlyMap<number, number>;
  /** The paintings whose links it followed, in order: its walk. */
  readonly expanded: readonly number[];
  /** Each link it followed, from the painting walked through to a painting it measured. */
  readonly followed: readonly (readonly [from: number, to: number])[];
  /** The nearest it had found on the layer so far: the paper's W. */
  readonly kept: ReadonlySet<number>;
}

/** A layer's work as the replay builds it up. */
interface LayerRecord {
  readonly measured: Map<number, number>;
  readonly expanded: number[];
  readonly followed: [from: number, to: number][];
  readonly kept: Set<number>;
}

/**
 * A search's record (see SearchRecorder) replayed up to some step: what it had done on each layer
 * it had come to by then. The Lab draws one for every frame of its replay.
 */
export class SearchReplay {
  /** Each layer the search had come to, the top one first, and its work there. */
  readonly layers: ReadonlyMap<number, LayerWork>;
  /** The layer it was on, or -1 before it started. */
  readonly level: number;
  /** How many paintings it had measured, on any layer. */
  readonly measured: number;
  /** Whether the replay has reached the record's end. */
  readonly done: boolean;

  private constructor(layers: ReadonlyMap<number, LayerWork>, level: number, measured: number, done: boolean) {
    this.layers = layers;
    this.level = level;
    this.measured = measured;
    this.done = done;
  }

  /** The first `count` steps of a record, replayed. */
  static of(steps: readonly SearchStep[], count: number): SearchReplay {
    const layers = new Map<number, LayerRecord>();
    const measured = new Set<number>();
    let layer: LayerRecord | undefined;
    let level = -1;
    let walkingFrom = -1;
    const shown = Math.min(count, steps.length);
    for (let index = 0; index < shown; index++) {
      const step = steps[index];
      if (step.kind === 'layer') {
        level = step.level;
        layer = { measured: new Map(), expanded: [], followed: [], kept: new Set() };
        layers.set(level, layer);
        walkingFrom = -1;
      } else if (!layer) {
        throw new Error('A search step came before its layer');
      } else if (step.kind === 'measure') {
        measured.add(step.node);
        layer.measured.set(step.node, step.distance);
        if (walkingFrom >= 0) layer.followed.push([walkingFrom, step.node]);
      } else if (step.kind === 'expand') {
        walkingFrom = step.node;
        layer.expanded.push(step.node);
      } else if (step.kind === 'keep') {
        layer.kept.add(step.node);
      } else {
        layer.kept.delete(step.node);
      }
    }
    return new SearchReplay(layers, level, measured.size, steps.length > 0 && shown === steps.length);
  }

  /**
   * The `count` nearest paintings the search had kept on the bottom layer, the nearest first,
   * leaving out a painting searched by its own colors: what it would answer if it stopped here.
   * None until it reaches the bottom layer.
   */
  nearest(count: number, leaveOut?: number): number[] {
    const bottom = this.layers.get(0);
    if (!bottom) return [];
    const distance = (node: number): number => bottom.measured.get(node) ?? Number.POSITIVE_INFINITY;
    return [...bottom.kept]
      .filter((node) => node !== leaveOut)
      .sort((first, second) => distance(first) - distance(second))
      .slice(0, count);
  }
}
