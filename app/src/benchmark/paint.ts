import { BYTES_PER_PIXEL, MAX_BYTE, type Srgb } from '@palette-atlas/color';
import { context2d } from '../image-adapters.ts';

/** A color chip with its name and hex code underneath. */
export class Swatch {
  readonly element = document.createElement('figure');
  readonly #chip = document.createElement('div');
  readonly #hex = document.createElement('code');

  constructor(name: string, color?: Srgb) {
    this.element.className = 'swatch';
    this.#chip.className = 'chip';
    const caption = document.createElement('figcaption');
    caption.append(name, document.createElement('br'), this.#hex);
    this.element.append(this.#chip, caption);
    this.show(color);
  }

  /** Shows a color, or an empty chip when there is none (an image with no visible pixel). */
  show(color: Srgb | undefined): void {
    const hex = color?.toHex();
    this.#chip.style.background = hex ?? 'transparent';
    this.#hex.textContent = hex ?? 'none';
  }
}

/** Paints colorAt(t) across a one-pixel-high canvas, from t = 0 at the left edge to 1 at the right. */
export function paintGradient(canvas: HTMLCanvasElement, colorAt: (t: number) => Srgb): void {
  const context = context2d(canvas);
  const { width } = canvas;
  const pixels = context.createImageData(width, 1);
  for (let x = 0; x < width; x++) {
    const [red, green, blue] = colorAt(x / (width - 1)).toBytes();
    pixels.data.set([red, green, blue, MAX_BYTE], x * BYTES_PER_PIXEL);
  }
  context.putImageData(pixels, 0, 0);
}
