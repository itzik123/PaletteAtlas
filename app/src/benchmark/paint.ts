import { BYTES_PER_PIXEL, MAX_BYTE, type RgbaImage, type Srgb } from '@palette-atlas/color';

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

/** A canvas showing an image at its own size. */
export function imageCanvas(image: RgbaImage): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  context2d(canvas).putImageData(toImageData(image), 0, 0);
  return canvas;
}

export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is not available');
  return context;
}

/** Adapter back to the browser: an RgbaImage as ImageData, copied unless it already is one. */
function toImageData(image: RgbaImage): ImageData {
  if (image instanceof ImageData) return image;
  return new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
}
