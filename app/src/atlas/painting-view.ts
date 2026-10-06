import { type CommonsImage, THUMBNAIL_WIDTHS, thumbnailWidthAtLeast } from '@palette-atlas/gallery';

/** The most a panning picture is enlarged on screen beyond the widest image Commons serves. */
const MAX_ENLARGEMENT = 2;
const WIDEST_THUMBNAIL = THUMBNAIL_WIDTHS[THUMBNAIL_WIDTHS.length - 1];

/**
 * A painting's picture on its page, as large as its card shows it in its shape (CSS sizes it: see
 * .painting-view). A painting too wide to see at the card's width, shorter there than the view's
 * --min-height (a handscroll, say), is shown taller instead, as tall as the page has room for but
 * never blown up past MAX_ENLARGEMENT, and pans sideways: by scrolling, swiping, or dragging it
 * with the mouse. Commons is asked for the picture at the width it is shown.
 */
export class PaintingView {
  readonly element = document.createElement('div');
  readonly #picture = document.createElement('img');
  readonly #image: CommonsImage;
  /** The width of the picture asked for so far. */
  #pictureWidth = 0;

  constructor(image: CommonsImage, aspect: number, title: string) {
    this.#image = image;
    this.element.className = 'painting-view';
    this.#picture.alt = title;
    this.#picture.draggable = false;
    this.#picture.style.setProperty('--aspect', String(aspect));
    // The height at which the widest thumbnail fills the picture, enlarged as far as allowed.
    this.#picture.style.setProperty('--sharpest', `${(MAX_ENLARGEMENT * WIDEST_THUMBNAIL) / aspect / devicePixelRatio}px`);
    this.element.append(this.#picture);

    new ResizeObserver(([view]) => {
      if (!view) return;
      const minHeight = Number.parseFloat(getComputedStyle(this.element).getPropertyValue('--min-height'));
      this.element.toggleAttribute('data-pan', view.contentRect.width / aspect < minHeight);
    }).observe(this.element);
    new ResizeObserver(([picture]) => {
      if (picture) this.#fit(picture.contentRect.width);
    }).observe(this.#picture);
    this.#dragToPan();
  }

  /** Asks for the picture as wide as it is shown, unless a wide enough one is there already. */
  #fit(shown: number): void {
    const width = thumbnailWidthAtLeast(Math.ceil(shown * devicePixelRatio));
    if (shown <= 0 || width <= this.#pictureWidth) return;
    this.#pictureWidth = width;
    this.#picture.src = this.#image.url(width);
  }

  /** A mouse pans a panning picture by dragging it, as a finger does by swiping. */
  #dragToPan(): void {
    let start: { x: number; scroll: number } | undefined;
    this.element.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || !this.element.hasAttribute('data-pan')) return;
      start = { x: event.clientX, scroll: this.element.scrollLeft };
      this.element.setPointerCapture(event.pointerId);
      this.element.classList.add('dragging');
    });
    this.element.addEventListener('pointermove', (event) => {
      if (start) this.element.scrollLeft = start.scroll - (event.clientX - start.x);
    });
    const stop = (): void => {
      start = undefined;
      this.element.classList.remove('dragging');
    };
    this.element.addEventListener('pointerup', stop);
    this.element.addEventListener('pointercancel', stop);
  }
}
