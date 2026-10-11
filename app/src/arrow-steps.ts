/** Where a key steps to along a row, from the item stepped to, if any, and the row's last item. */
type Step = (at: number | undefined, last: number) => number;

const KEYS: Readonly<Partial<Record<string, Step>>> = {
  ArrowRight: (at) => (at === undefined ? 0 : at + 1),
  ArrowUp: (at) => (at === undefined ? 0 : at + 1),
  ArrowLeft: (at, last) => (at === undefined ? last : at - 1),
  ArrowDown: (at, last) => (at === undefined ? last : at - 1),
  Home: () => 0,
  End: (_, last) => last,
};

/** A row of items to step along. */
export interface StepRow {
  /** The row's name, for a screen reader. */
  readonly name: string;
  /** Hears each item stepped to, or none. */
  readonly onStep: (item: number | undefined) => void;
  /** What the row says of itself to a screen reader: the item stepped to in words, or the whole row for none. */
  readonly describe: (item: number | undefined) => string;
  /** What the focus may move into without letting go, a label of the item, say: the row alone if not given. */
  readonly within?: HTMLElement;
}

/**
 * Steps along a row of items by keyboard, as pointing along it does: → and ↑ to the next, ← and ↓
 * to the one before, Home and End to either end, and Escape (or the focus leaving) lets go. The row is
 * one stop for Tab, and a slider to a screen reader, which tells the item stepped to in words.
 *
 * Adapter: turns keys into the same reports the row's pointer makes, and its owner tells it of
 * every item pointed at by either (see show), so the keys go on from where the pointer was.
 */
export class ArrowSteps {
  readonly #element: HTMLElement;
  readonly #describe: StepRow['describe'];
  #count = 0;
  #at: number | undefined;

  /** Makes an element a row of items. */
  constructor(element: HTMLElement, { name, onStep, describe, within = element }: StepRow) {
    this.#element = element;
    this.#describe = describe;
    element.tabIndex = 0;
    element.setAttribute('role', 'slider');
    element.setAttribute('aria-label', name);
    element.setAttribute('aria-valuemin', '0');
    element.addEventListener('keydown', (event) => {
      if (this.#count === 0 || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'Escape') {
        if (this.#at === undefined) return;
        event.preventDefault();
        onStep(undefined);
        return;
      }
      const step = KEYS[event.key];
      if (!step) return;
      // Handled here, so the page's own arrows (from painter to painter, say) stay put.
      event.preventDefault();
      onStep(Math.min(Math.max(step(this.#at, this.#count - 1), 0), this.#count - 1));
    });
    element.addEventListener('focusout', ({ relatedTarget }) => {
      if (this.#at !== undefined && !(relatedTarget instanceof Node && within.contains(relatedTarget))) onStep(undefined);
    });
  }

  /** Sets how many items the row has, none of them stepped to. */
  setCount(count: number): void {
    this.#count = count;
    this.#element.setAttribute('aria-valuemax', String(count));
    this.show(undefined);
  }

  /** Shows an item as the one stepped to, however it was picked, or none. */
  show(item: number | undefined): void {
    this.#at = item;
    // 0 stands for none, before the first.
    this.#element.setAttribute('aria-valuenow', String(item === undefined ? 0 : item + 1));
    this.#element.setAttribute('aria-valuetext', this.#describe(item));
  }
}
