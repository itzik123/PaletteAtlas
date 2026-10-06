import { BYTES_PER_PIXEL } from '@palette-atlas/color';
import { dateOf, titleOf } from '../atlas/painting-text.ts';
import { context2d } from '../image-adapters.ts';
import type { BarcodeDesign, BarcodeLayout, Box, Mark } from './barcode-design.ts';
import type { Career } from './career.ts';
import { paintMarks } from './paint-marks.ts';
import type { Tick } from './year-ticks.ts';

/**
 * How far the outline round the painting pointed at reaches past its mark, and the least it spans
 * across the mark, in CSS pixels: a bar thinner than that still stands out.
 */
const CURSOR = { reach: 5, least: 12 } as const;
/** The size of the picture in a painting's label, in CSS pixels: its height, and the most it may be wide. */
const LABEL_PICTURE = { height: 72, maxWidth: 160 } as const;
/** The layout of a career without a painting to place. */
const NO_MARKS: BarcodeLayout = { marks: [], ticks: [], outlines: [] };

/**
 * One design's barcode of the career on show, drawn at the screen's resolution and again whenever
 * its width changes, with the years marked under it. Pointing at a painting outlines it and shows
 * its museum label; a click opens its page.
 */
export class BarcodeView {
  readonly element = document.createElement('figure');
  readonly #design: BarcodeDesign;
  readonly #frame = document.createElement('div');
  readonly #canvas = document.createElement('canvas');
  readonly #outlines = document.createElement('div');
  readonly #ruler = document.createElement('div');
  readonly #cursor = document.createElement('div');
  readonly #label = document.createElement('div');
  readonly #picture = document.createElement('img');
  readonly #title = document.createElement('b');
  readonly #date = document.createElement('span');
  #career: Career | undefined;
  #colors: readonly Float64Array[] = [];
  #marks: readonly Mark[] = [];
  #pointed: Mark | undefined;
  /** The width it was drawn at, in CSS pixels. */
  #width = 0;

  constructor(design: BarcodeDesign) {
    this.#design = design;
    this.element.className = 'barcode-mockup';
    const caption = document.createElement('figcaption');
    caption.innerHTML = '<span class="design-letter" aria-hidden="true"></span><span><b></b> <span></span></span>';
    caption.querySelector('.design-letter')!.textContent = design.letter;
    caption.querySelector('b')!.textContent = design.name;
    caption.querySelector('b + span')!.textContent = design.summary;

    this.#frame.className = 'barcode-frame';
    this.#frame.toggleAttribute('data-carded', design.carded);
    const clip = document.createElement('div');
    clip.className = 'barcode-clip';
    clip.append(this.#canvas);
    this.#outlines.className = 'barcode-outlines';
    this.#ruler.className = 'barcode-ruler';
    this.#cursor.className = 'barcode-cursor';
    this.#label.className = 'barcode-label';
    this.#picture.alt = '';
    const text = document.createElement('span');
    text.append(this.#title, this.#date);
    this.#label.append(this.#picture, text);
    this.#frame.append(clip, this.#outlines, this.#cursor, this.#ruler, this.#label);
    this.element.append(caption, this.#frame);
    this.#point(undefined);

    new ResizeObserver(() => {
      if (this.#frame.clientWidth !== this.#width) this.#draw();
    }).observe(this.#frame);
    this.#canvas.addEventListener('pointermove', (event) => this.#point(this.#markAt(event)));
    this.#canvas.addEventListener('pointerleave', () => this.#point(undefined));
    this.#canvas.addEventListener('click', (event) => {
      const mark = this.#markAt(event);
      if (mark && this.#career) location.assign(`./painting.html?id=${this.#career.paintings[mark.painting].entry.painting.id}`);
    });
  }

  /** Shows a career, each of its paintings in the colors given for it (see BarFill), in the order of Career.paintings. */
  show(career: Career, colors: readonly Float64Array[]): void {
    this.#career = career;
    this.#colors = colors;
    this.#draw();
  }

  #draw(): void {
    this.#width = this.#frame.clientWidth;
    const career = this.#career;
    if (!career || this.#width <= 0) return;
    this.#point(undefined);
    const height = this.#design.height(career, this.#width);
    this.#frame.toggleAttribute('data-empty', career.paintings.length === 0);
    const layout = career.paintings.length > 0 ? this.#design.layout(career, this.#width, height) : NO_MARKS;
    this.#marks = layout.marks;
    const image = paintMarks(layout.marks, (painting) => this.#colors[painting], this.#width, height, devicePixelRatio);
    this.#canvas.width = image.width;
    this.#canvas.height = image.height;
    this.#canvas.style.height = `${height}px`;
    context2d(this.#canvas).putImageData(image, 0, 0);
    this.#outlines.replaceChildren(...layout.outlines.map((box) => placed(document.createElement('span'), box)));
    this.#ruler.replaceChildren(...layout.ticks.map(tickLabel));
  }

  /** The mark under the pointer, if any. */
  #markAt(event: MouseEvent): Mark | undefined {
    const x = event.offsetX;
    const y = event.offsetY;
    return this.#marks.find((mark) => x >= mark.x && x < mark.x + mark.width && y >= mark.y && y < mark.y + mark.height);
  }

  /** Outlines the painting pointed at and shows its label under the barcode, or hides them for none. */
  #point(mark: Mark | undefined): void {
    if (mark === this.#pointed && mark !== undefined) return;
    this.#pointed = mark;
    this.#cursor.hidden = mark === undefined;
    this.#label.hidden = mark === undefined;
    this.#canvas.style.cursor = mark ? 'pointer' : '';
    const entry = mark && this.#career?.paintings[mark.painting].entry;
    if (!mark || !entry) return;
    placed(this.#cursor, cursorBox(mark));

    const { painting, image, strip } = entry;
    this.#title.textContent = titleOf(painting);
    this.#date.textContent = dateOf(painting);
    const aspect = painting.width / painting.height;
    this.#picture.style.width = `${Math.min(LABEL_PICTURE.height * aspect, LABEL_PICTURE.maxWidth)}px`;
    this.#picture.style.height = `${LABEL_PICTURE.height}px`;
    // Until the picture arrives, the middle of its strip stands in for it.
    const middle = Math.floor(strip.width / 2) * BYTES_PER_PIXEL;
    this.#picture.style.backgroundColor = `rgb(${strip.data[middle]} ${strip.data[middle + 1]} ${strip.data[middle + 2]})`;
    // A wide picture is cut to fit, so it is asked for as wide as its full height needs.
    this.#picture.src = image.urlAtLeast(LABEL_PICTURE.height * aspect * devicePixelRatio);
    // Under the painting, as far as the barcode's edges allow.
    const labelWidth = this.#label.offsetWidth;
    const left = Math.min(Math.max(mark.x + mark.width / 2 - labelWidth / 2, 0), this.#width - labelWidth);
    this.#label.style.left = `${left}px`;
  }
}

/** The outline round a mark: a little bigger on every side, and at least CURSOR.least across. */
function cursorBox(mark: Mark): Box {
  const upright = mark.direction === 'up';
  const width = upright ? Math.max(mark.width, CURSOR.least) : mark.width;
  const height = upright ? mark.height : Math.max(mark.height, CURSOR.least);
  return {
    x: mark.x + (mark.width - width) / 2 - CURSOR.reach,
    y: mark.y + (mark.height - height) / 2 - CURSOR.reach,
    width: width + 2 * CURSOR.reach,
    height: height + 2 * CURSOR.reach,
  };
}

/** Places an element over a box of the barcode. */
function placed<T extends HTMLElement>(element: T, { x, y, width, height }: Box): T {
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  return element;
}

function tickLabel({ x, year }: Tick): HTMLElement {
  const label = document.createElement('span');
  label.className = 'barcode-tick';
  label.style.left = `${x}px`;
  label.textContent = String(year);
  return label;
}
