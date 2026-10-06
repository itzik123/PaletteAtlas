import { BYTES_PER_PIXEL, type RgbaImage, resize } from '@palette-atlas/color';
import { placedYear } from '@palette-atlas/gallery';
import { paintImage } from '../image-adapters.ts';
import type { BarFill } from './bar-fills.ts';
import type { Career, PaintingEntry } from './gallery-data.ts';
import { dateOf, titleOf } from './painting-text.ts';
import { type Tick, yearTicks } from './year-ticks.ts';

/**
 * How far the outline round the painting pointed at reaches past its bar, and the least it spans
 * across the bar, in CSS pixels: a hairline bar still stands out.
 */
const CURSOR = { reach: 5, least: 12 } as const;
/** The size of the picture in a painting's label, in CSS pixels: its height, and the most it may be wide. */
const LABEL_PICTURE = { height: 72, maxWidth: 160 } as const;

/**
 * An artist's career as a barcode: every painting a bar of the same width, oldest first, showing
 * the painting as a fill says (see BarFill), with the years marked under it where their paintings
 * begin. It is drawn at the screen's resolution by area averaging in linear light, and again
 * whenever its size changes. Pointing at a bar outlines it and shows the painting's museum label,
 * and a click opens the painting's page; on a touch screen, a tap shows the label, and a tap on the
 * label opens the page.
 */
export class CareerBarcode {
  readonly element = document.createElement('figure');
  readonly #paintings: readonly PaintingEntry[];
  readonly #years: readonly number[];
  readonly #frame = document.createElement('div');
  readonly #canvas = document.createElement('canvas');
  readonly #ruler = document.createElement('div');
  readonly #cursor = document.createElement('div');
  readonly #label = document.createElement('a');
  readonly #picture = document.createElement('img');
  readonly #title = document.createElement('b');
  readonly #date = document.createElement('span');
  /** Each fill's barcode at one pixel per painting, made the first time the fill is shown. */
  readonly #barcodes = new Map<BarFill, RgbaImage>();
  #fill: BarFill;
  /** The size it was drawn at, in CSS pixels. */
  #width = 0;
  #height = 0;
  /** The painting whose label shows, by its place in the career. */
  #pointed: number | undefined;
  /** Whether the last pointer pressed on it was a mouse, whose click opens a painting at once. */
  #mouse = true;

  constructor({ artist, paintings }: Career, fill: BarFill) {
    this.#paintings = paintings;
    this.#years = paintings.map(({ painting }) => placedYear(painting, artist) ?? painting.year);
    this.#fill = fill;
    this.element.className = 'career-barcode';
    this.#frame.className = 'barcode-frame';
    this.#canvas.setAttribute('role', 'img');
    this.#canvas.setAttribute('aria-label', `Career Barcode: ${describe(this.#years)}`);
    this.#ruler.className = 'barcode-ruler';
    this.#ruler.setAttribute('aria-hidden', 'true');
    this.#cursor.className = 'barcode-cursor';
    this.#label.className = 'barcode-label';
    this.#picture.alt = '';
    // A picture that fails to arrive leaves its stand-in color, rather than a broken image.
    this.#picture.addEventListener('error', () => this.#picture.removeAttribute('src'));
    const text = document.createElement('span');
    text.append(this.#title, this.#date);
    this.#label.append(this.#picture, text);
    this.#frame.append(this.#canvas, this.#cursor, this.#ruler, this.#label);
    this.element.append(this.#frame);
    this.#point(undefined);

    new ResizeObserver(() => {
      if (this.#frame.clientWidth !== this.#width || this.#frame.clientHeight !== this.#height) this.#draw();
    }).observe(this.#frame);
    this.#canvas.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'mouse') this.#point(this.#barAt(event));
    });
    this.#canvas.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') this.#point(undefined);
    });
    this.#canvas.addEventListener('pointerdown', (event) => {
      this.#mouse = event.pointerType === 'mouse';
      this.#point(this.#barAt(event));
    });
    this.#canvas.addEventListener('click', () => {
      if (this.#mouse && this.#pointed !== undefined) location.assign(this.#label.href);
    });
    // A tap anywhere else puts the label away.
    document.addEventListener('pointerdown', (event) => {
      if (!this.element.contains(event.target as Node)) this.#point(undefined);
    });
  }

  /** Shows every painting in another fill. */
  show(fill: BarFill): void {
    this.#fill = fill;
    this.#draw();
  }

  #draw(): void {
    this.#width = this.#frame.clientWidth;
    this.#height = this.#frame.clientHeight;
    if (this.#width <= 0 || this.#height <= 0) return;
    this.#point(undefined);
    let barcode = this.#barcodes.get(this.#fill);
    if (!barcode) {
      barcode = this.#fill.barcode(this.#paintings.map(({ strip }) => strip));
      this.#barcodes.set(this.#fill, barcode);
    }
    const scale = devicePixelRatio;
    paintImage(this.#canvas, resize(barcode, Math.max(1, Math.round(this.#width * scale)), Math.max(1, Math.round(this.#height * scale))));
    this.#ruler.replaceChildren(...yearTicks(this.#years, this.#width).map(tickLabel));
  }

  /** The painting whose bar is under the pointer, by its place in the career. */
  #barAt(event: PointerEvent): number {
    const bar = Math.floor((event.offsetX / this.#canvas.clientWidth) * this.#paintings.length);
    return Math.min(Math.max(bar, 0), this.#paintings.length - 1);
  }

  /** Outlines a painting's bar and shows its label under the barcode, or hides them for none. */
  #point(bar: number | undefined): void {
    if (bar === this.#pointed && bar !== undefined) return;
    this.#pointed = bar;
    this.#cursor.hidden = bar === undefined;
    this.#label.hidden = bar === undefined;
    const entry = bar === undefined ? undefined : this.#paintings[bar];
    if (bar === undefined || !entry) return;

    const barWidth = this.#width / this.#paintings.length;
    const width = Math.max(barWidth, CURSOR.least);
    this.#cursor.style.left = `${bar * barWidth + (barWidth - width) / 2 - CURSOR.reach}px`;
    this.#cursor.style.top = `${-CURSOR.reach}px`;
    this.#cursor.style.width = `${width + 2 * CURSOR.reach}px`;
    this.#cursor.style.height = `${this.#height + 2 * CURSOR.reach}px`;

    const { painting, image, strip } = entry;
    this.#label.href = `./painting.html?id=${painting.id}`;
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
    const left = Math.min(Math.max((bar + 0.5) * barWidth - labelWidth / 2, 0), this.#width - labelWidth);
    this.#label.style.left = `${Math.max(left, 0)}px`;
  }
}

/** A career's paintings in words, by their years in order: how many, from when to when. */
function describe(years: readonly number[]): string {
  const first = years[0];
  const last = years.at(-1);
  const count = `${years.length} ${years.length === 1 ? 'painting' : 'paintings'}`;
  return first === last ? `${count}, ${first}` : `${count}, ${first}–${last}`;
}

function tickLabel({ x, year }: Tick): HTMLElement {
  const label = document.createElement('span');
  label.className = 'barcode-tick';
  label.style.left = `${x}px`;
  label.textContent = String(year);
  return label;
}
