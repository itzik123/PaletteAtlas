import { RETRY_ICON } from '../icons.ts';
import type { GalleryData } from './gallery-data.ts';
import { Wall } from './wall.ts';
import { type WallPlace, WallPlaces } from './wall-place.ts';

/** Paintings hung at a time. */
const PAGE_SIZE = 60;
/** How far below the screen the wall's end may be when the next paintings are hung, so they're ready before the visitor gets there. */
const LOAD_AHEAD = '1500px';
/** How long scrolling must pause before the place on the wall is saved. */
const SAVE_DELAY_MS = 250;

/**
 * The Atlas: every painting of the gallery on one wall, the most famous first, with more hung as
 * the visitor scrolls toward the end. It keeps its place (see WallPlaces), so a visitor who comes
 * back from a painting finds the wall as they left it.
 */
export class Atlas {
  readonly element = document.createElement('main');
  readonly #data: GalleryData;
  readonly #wall = new Wall();
  /** Sits after the wall; nearing the screen, it asks for more paintings. */
  readonly #end = document.createElement('div');
  readonly #watcher: IntersectionObserver;
  /** How many paintings are hung: the position of the next one. */
  #hung = 0;
  #saveTimer: ReturnType<typeof setTimeout> | undefined;

  /** Starts at the top of the wall, or where the visitor was when they left it. */
  constructor(data: GalleryData, place?: WallPlace) {
    this.#data = data;
    this.element.className = 'atlas';
    const headline = document.createElement('h1');
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = data.count.toLocaleString('en');
    headline.append(count, ' paintings, strip by strip.');
    this.#end.className = 'wall-end';
    this.element.append(headline, this.#wall.element, this.#end);
    this.#watcher = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void this.#hangMore(PAGE_SIZE);
      },
      { rootMargin: `0px 0px ${LOAD_AHEAD} 0px` },
    );

    addEventListener(
      'scroll',
      () => {
        clearTimeout(this.#saveTimer);
        this.#saveTimer = setTimeout(() => this.#save(), SAVE_DELAY_MS);
      },
      { passive: true },
    );
    // Saved at once too as the visitor opens a painting or leaves, however soon after scrolling.
    this.#wall.element.addEventListener('click', () => this.#save());
    addEventListener('pagehide', () => this.#save());

    if (place) void this.#return(place);
    else this.#watcher.observe(this.#end);
  }

  /** Hangs the paintings that were hung, then scrolls to where the visitor was, before hanging more as usual. */
  async #return(place: WallPlace): Promise<void> {
    if (await this.#hangMore(Math.max(place.hung, PAGE_SIZE))) {
      // The headline's font changes its height as it arrives, moving the wall.
      await document.fonts.ready;
      this.#wall.scrollTo(place.painting, place.offset);
    }
  }

  /** Hangs the next paintings, up to `count`, and says whether they arrived. */
  async #hangMore(count: number): Promise<boolean> {
    this.#watcher.unobserve(this.#end);
    this.#end.replaceChildren();
    this.element.setAttribute('aria-busy', 'true');
    const entries = await this.#data.entries(this.#hung, count).catch(() => undefined);
    this.element.removeAttribute('aria-busy');
    if (!entries) {
      this.#end.append(this.#retryButton());
      return false;
    }
    this.#hung += entries.length;
    this.#wall.append(entries);
    // Watched anew, the end reports at once if it is still near the screen, and more are hung.
    if (this.#hung < this.#data.count) this.#watcher.observe(this.#end);
    return true;
  }

  #save(): void {
    clearTimeout(this.#saveTimer);
    const top = this.#wall.topPainting();
    if (top) WallPlaces.save({ hung: this.#hung, ...top });
  }

  /** Offered when paintings fail to arrive (the connection dropped, say), to ask for them again. */
  #retryButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pill';
    button.innerHTML = `${RETRY_ICON}<span>Try again</span>`;
    button.addEventListener('click', () => void this.#hangMore(PAGE_SIZE));
    return button;
  }
}
