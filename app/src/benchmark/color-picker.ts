import { LinearRgb, type RgbaImage, Srgb } from '@palette-atlas/color';
import type { Spot } from './benchmark-images.ts';
import { regionAround } from './region.ts';

/** Pixels in each direction averaged into a picked color, so render noise doesn't decide it. */
const PICK_RADIUS = 3;
/** Shown for a fully transparent region, which has no color. */
const BLACK = new Srgb(0, 0, 0);

/**
 * An image to pick two colors from: each click moves the next marker, A then B.
 * Observer: every change of the pair is reported to the listener.
 */
export class ColorPicker {
  readonly element = document.createElement('div');
  readonly #image: RgbaImage;
  readonly #spots: [Spot, Spot];
  readonly #markers: [HTMLElement, HTMLElement] = [marker('A'), marker('B')];
  readonly #onChange: (from: Srgb, to: Srgb) => void;
  #nextMarker = 0;

  constructor(url: string, image: RgbaImage, spots: readonly [Spot, Spot], onChange: (from: Srgb, to: Srgb) => void) {
    this.#image = image;
    this.#spots = [spots[0], spots[1]];
    this.#onChange = onChange;
    const picture = document.createElement('img');
    picture.src = url;
    picture.alt = '';
    picture.draggable = false;
    this.element.className = 'picker';
    this.element.append(picture, ...this.#markers);
    this.element.addEventListener('click', (event) => this.#pick(event));
    this.#refresh();
  }

  #pick(event: MouseEvent): void {
    const bounds = this.element.getBoundingClientRect();
    this.#spots[this.#nextMarker] = {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    };
    this.#nextMarker = 1 - this.#nextMarker;
    this.#refresh();
  }

  #refresh(): void {
    this.#spots.forEach((spot, index) => {
      this.#markers[index].style.left = `${spot.x * 100}%`;
      this.#markers[index].style.top = `${spot.y * 100}%`;
    });
    this.#onChange(this.#colorAt(this.#spots[0]), this.#colorAt(this.#spots[1]));
  }

  #colorAt(spot: Spot): Srgb {
    const x = Math.min(Math.floor(spot.x * this.#image.width), this.#image.width - 1);
    const y = Math.min(Math.floor(spot.y * this.#image.height), this.#image.height - 1);
    return LinearRgb.average(regionAround(this.#image, x, y, PICK_RADIUS))?.toSrgb() ?? BLACK;
  }
}

function marker(label: string): HTMLElement {
  const element = document.createElement('span');
  element.className = 'marker';
  element.textContent = label;
  return element;
}
