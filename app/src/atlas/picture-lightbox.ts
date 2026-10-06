import type { CommonsImage } from '@palette-atlas/gallery';

/** The frames a painting is shown enlarged in (see atlas.css): one for each painting, always the same. */
const FRAMES = ['carved-gilt', 'beaded-gilt', 'lacquer-mat', 'walnut', 'velvet-gilt', 'silver-leaf'] as const;
/** How far a pointer may move between press and release for a click, not a drag, in CSS pixels. */
const CLICK_SLOP = 5;

/**
 * A painting enlarged over its page, as large as fits the screen, in a frame picked for it, the
 * page darkened behind it. It rises into place and sinks back away (see atlas.css), and a click
 * anywhere or Escape puts it away. The picture shown on the page stands in until Commons sends one
 * as large as the enlarged picture.
 */
export class PictureLightbox {
  readonly element = document.createElement('dialog');
  readonly #picture = document.createElement('img');
  readonly #image: CommonsImage;
  #enlarged = false;

  constructor(image: CommonsImage, size: { width: number; height: number }, title: string, id: string) {
    this.#image = image;
    this.element.className = `lightbox ${frameOf(id)}`;
    this.element.setAttribute('aria-label', title);
    this.#picture.alt = title;
    this.#picture.width = size.width;
    this.#picture.height = size.height;
    this.element.append(this.#picture);
    this.element.addEventListener('click', () => this.element.close());
  }

  /** Opens on a click on a picture, not on a drag across it (a wide one pans). */
  openOnClick(picture: HTMLElement): void {
    let pressed = { x: 0, y: 0 };
    picture.addEventListener('pointerdown', ({ clientX, clientY }) => (pressed = { x: clientX, y: clientY }));
    picture.addEventListener('click', ({ clientX, clientY }) => {
      if (Math.hypot(clientX - pressed.x, clientY - pressed.y) > CLICK_SLOP) return;
      this.open(picture.querySelector('img')?.currentSrc ?? '');
    });
  }

  /** Shows the painting enlarged, the picture already shown standing in at first. */
  open(shown: string): void {
    if (!this.#enlarged) this.#picture.src = shown;
    this.element.showModal();
    if (this.#enlarged) return;
    this.#enlarged = true;
    const larger = new Image();
    larger.addEventListener('load', () => (this.#picture.src = larger.src));
    larger.src = this.#image.urlAtLeast(this.#picture.clientWidth * devicePixelRatio);
  }
}

/** The frame picked for a painting, by its Wikidata item: at random, but the same every time. */
function frameOf(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FRAMES[hash % FRAMES.length] ?? FRAMES[0];
}
