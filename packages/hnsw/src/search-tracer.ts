/**
 * Hears each step of a search as the search takes it, in the paper's terms: the layer it is on,
 * each node it measures, each node whose links it follows, and the nearest nodes found so far on
 * the layer (its W), as nodes join and leave them. The Lab replays these steps, so what it shows
 * is what the code did.
 *
 * Observer: the search reports to whichever tracer it is given, and knows nothing of what the
 * tracer does with the steps. Each step is a call with plain numbers, so a tracer that ignores
 * them (SILENT_TRACER) makes nothing and costs next to nothing.
 */
export interface SearchTracer {
  /** The search moves to a layer: the top one first, the bottom one, 0, last. */
  layer(level: number): void;
  /** The search measured how far a node lies from the query. */
  measure(node: number, distance: number): void;
  /** The search follows a node's links on the current layer, measuring the nodes they lead to. */
  expand(node: number): void;
  /** A node joins the nearest found so far on the current layer. */
  keep(node: number): void;
  /** A node leaves the nearest found so far, displaced by a nearer one. */
  drop(node: number): void;
}

/**
 * A tracer that ignores every step, for the searches no one watches.
 *
 * Null Object: a search always has a tracer to report to, so it never checks for none.
 */
class SilentTracer implements SearchTracer {
  layer(): void {}
  measure(): void {}
  expand(): void {}
  keep(): void {}
  drop(): void {}
}

/** The tracer searches report to unless they are given another. It keeps no state, so one serves them all. */
export const SILENT_TRACER: SearchTracer = new SilentTracer();

/** A step of a search, as SearchRecorder records it. */
export type SearchStep =
  | { readonly kind: 'layer'; readonly level: number }
  | { readonly kind: 'measure'; readonly node: number; readonly distance: number }
  | { readonly kind: 'expand'; readonly node: number }
  | { readonly kind: 'keep'; readonly node: number }
  | { readonly kind: 'drop'; readonly node: number };

/** Records a search's steps in order, for the Lab to replay. */
export class SearchRecorder implements SearchTracer {
  readonly #steps: SearchStep[] = [];

  /** The steps recorded so far, in order. */
  get steps(): readonly SearchStep[] {
    return this.#steps;
  }

  layer(level: number): void {
    this.#steps.push({ kind: 'layer', level });
  }

  measure(node: number, distance: number): void {
    this.#steps.push({ kind: 'measure', node, distance });
  }

  expand(node: number): void {
    this.#steps.push({ kind: 'expand', node });
  }

  keep(node: number): void {
    this.#steps.push({ kind: 'keep', node });
  }

  drop(node: number): void {
    this.#steps.push({ kind: 'drop', node });
  }
}
