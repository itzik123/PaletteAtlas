import { type CommonsImage, thumbnailWidthAtLeast } from '@palette-atlas/gallery';

/** The frames a painting is shown enlarged in (see atlas.css): one for each painting, always the same. */
const FRAMES = ['carved-gilt', 'beaded-gilt', 'lacquer-mat', 'walnut', 'velvet-gilt', 'silver-leaf'] as const;
/** How far a pointer may move between press and release for a click, not a drag, in CSS pixels. */
const CLICK_SLOP = 5;

/**
 * A painting enlarged over its page, as large as fits the screen, in a frame picked for it, the
 * page darkened behind it. It rises into place and sinks back away (see atlas.css), and a click
 * anywhere or Escape puts it away, the focus going back to the picture it was opened from. CSS
 * sizes the picture from the painting's shape before any image arrives, so Commons is asked for
 * one as wide as it is shown; the picture on the page, if it has arrived, stands in until then.
 */
export class PictureLightbox {
  readonly element = document.createElement('dialog');
  readonly #picture = document.createElement('img');
  readonly #image: CommonsImage;
  /** The width of the picture asked for so far. */
  #pictureWidth = 0;

  constructor(image: CommonsImage, aspect: number, title: string, id: string) {
    this.#image = image;
    this.element.className = `lightbox ${frameOf(id)}`;
    this.element.setAttribute('aria-label', title);
    this.#picture.alt = title;
    this.#picture.style.setProperty('--aspect', String(aspect));
    // Never enlarged past the file itself.
    this.#picture.style.setProperty('--widest', `${image.width}px`);
    this.element.append(this.#picture);
    this.element.addEventListener('click', () => this.element.close());
  }

  /**
   * Makes a picture the button that opens it: on a click, not on a drag across it (a wide one
   * pans), or on Enter or Space.
   */
  openFrom(picture: HTMLElement): void {
    picture.tabIndex = 0;
    picture.setAttribute('role', 'button');
    picture.setAttribute('aria-label', 'Enlarge');
    picture.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      this.open(picture.querySelector('img'));
    });
    let pressed = { x: 0, y: 0 };
    picture.addEventListener('pointerdown', ({ clientX, clientY }) => (pressed = { x: clientX, y: clientY }));
    picture.addEventListener('click', ({ clientX, clientY }) => {
      if (Math.hypot(clientX - pressed.x, clientY - pressed.y) > CLICK_SLOP) return;
      this.open(picture.querySelector('img'));
    });
  }

  /**
   * Shows the painting enlarged: the picture shown on the page stands in at first, if it has
   * arrived, and a wider one is asked for whenever the enlarged picture is shown wider than that
   * (the window grown since, say).
   */
  open(shown: HTMLImageElement | null): void {
    this.element.showModal();
    const width = thumbnailWidthAtLeast(Math.ceil(this.#picture.clientWidth * devicePixelRatio));
    if (!this.#picture.src && shown?.complete && shown.naturalWidth > 0) {
      this.#picture.src = shown.currentSrc;
      this.#pictureWidth = shown.naturalWidth;
    }
    if (width <= this.#pictureWidth) return;
    this.#pictureWidth = width;
    const url = this.#image.url(width);
    if (!this.#picture.src) {
      this.#picture.src = url;
      return;
    }
    const wider = new Image();
    wider.addEventListener('load', () => {
      // Unless a wider one has been asked for since.
      if (width === this.#pictureWidth) this.#picture.src = url;
    });
    wider.src = url;
  }
}

/** The frame picked for a painting, by its Wikidata item: at random, but the same every time. */
function frameOf(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FRAMES[hash % FRAMES.length] ?? FRAMES[0];
}
