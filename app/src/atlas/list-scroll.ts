/** What the visitor does to scroll a list themselves, which lets go of what the page held in view. */
const VISITOR_SCROLLS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

/**
 * Scrolls a list to the items the page puts in view, and holds the last of them where it was put
 * while sections of the list out of sight are laid out and take their true heights in place of
 * estimates (see atlas.css), until the visitor scrolls the list themselves. Positions are measured
 * on the screen, since an item's offsetTop counts from a section that is laid out only in sight.
 */
export class ListScroll {
  readonly #list: HTMLElement;
  /** The item held in view, and how far below the list's top. */
  #held: { item: Element; top: number } | undefined;

  /** Scrolls a list whose sections, its children, are all in it already. */
  constructor(list: HTMLElement) {
    this.#list = list;
    const settled = new ResizeObserver(() => {
      if (this.#held) list.scrollTop = this.topOf(this.#held.item) - this.#held.top;
    });
    for (const section of list.children) settled.observe(section);
    for (const type of VISITOR_SCROLLS) list.addEventListener(type, () => this.release(), { passive: true });
  }

  /** How far down the list an item lies, from the top of all it holds. */
  topOf(item: Element): number {
    return item.getBoundingClientRect().top - this.#list.getBoundingClientRect().top + this.#list.scrollTop;
  }

  /** Scrolls to put an item at the list's top, or as near as the list's end allows. */
  toTop(item: Element): void {
    this.#list.scrollTop = this.topOf(item);
    this.#hold(item);
  }

  /** Scrolls just enough to show an item whole, clear of what covers the list's top (a heading, say). */
  toNearest(item: HTMLElement, covered: number): void {
    const top = this.topOf(item);
    if (top - covered < this.#list.scrollTop) {
      this.#list.scrollTop = top - covered;
    } else if (top + item.offsetHeight > this.#list.scrollTop + this.#list.clientHeight) {
      this.#list.scrollTop = top + item.offsetHeight - this.#list.clientHeight;
    }
    this.#hold(item);
  }

  /**
   * Scrolls to put an item in the middle of what the list shows below what covers its top, the
   * list starting at the top of an item before it, so that none shows cut off.
   */
  toMiddle(item: HTMLElement, covered: number): void {
    const top = this.topOf(item);
    const half = (this.#list.clientHeight - covered - item.offsetHeight) / 2;
    let first: Element = item;
    while (first.previousElementSibling && top - this.topOf(first.previousElementSibling) <= half) {
      first = first.previousElementSibling;
    }
    this.#list.scrollTop = this.topOf(first) - covered;
    this.#hold(item);
  }

  /** Lets go of the item held in view. */
  release(): void {
    this.#held = undefined;
  }

  #hold(item: Element): void {
    this.#held = { item, top: this.topOf(item) - this.#list.scrollTop };
  }
}
