import type { Srgb } from '@palette-atlas/color';
import type { SourceMap } from '@palette-atlas/strip';
import type { Picture } from '../atlas/image-query.ts';
import { SourceHighlight } from '../source-highlight.ts';

/** How much of the picture the veil hides around the segment it uncovers. */
const VEIL_OPACITY = 0.82;

/** A point on the picture, as fractions of its width and height from the top left, each from 0 up to 1. */
export interface Spot {
  readonly x: number;
  readonly y: number;
}

/**
 * The picture, matted on a card, with a veil over it that can uncover the pixels of one strip
 * segment. Observer: pointing at the picture reports the spot under the pointer, and leaving it
 * reports undefined.
 */
export class PictureView {
  readonly element = document.createElement('div');
  /** The picture and its veil, one over the other, in the picture's shape. */
  readonly #stack = document.createElement('div');
  readonly #picture = document.createElement('canvas');
  readonly #veil = new SourceHighlight(VEIL_OPACITY);
  /** The picture's size: the canvas keeps its own, and only shows the bitmap. */
  #size = { width: 0, height: 0 };

  constructor(onPoint: (spot: Spot | undefined) => void) {
    this.element.className = 'picture-frame';
    this.#stack.className = 'picture-stack';
    this.#picture.setAttribute('role', 'img');
    this.#veil.element.className = 'source-veil';
    this.#stack.append(this.#picture, this.#veil.element);
    this.element.append(this.#stack);

    const report = (event: PointerEvent): void => {
      const box = this.#stack.getBoundingClientRect();
      onPoint({ x: fraction(event.clientX - box.left, box.width), y: fraction(event.clientY - box.top, box.height) });
    };
    this.#stack.addEventListener('pointermove', report);
    // A tap on a touch screen points without moving first.
    this.#stack.addEventListener('pointerdown', report);
    // A finger lifts off the screen as it leaves, so a tapped segment stays shown until the next tap.
    this.#stack.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') onPoint(undefined);
    });
  }

  /** Shows a decoded picture, taking it over: the canvas draws the bitmap as it is, without copying it. */
  show(picture: ImageBitmap, name: string): void {
    this.#size = { width: picture.width, height: picture.height };
    this.#stack.style.setProperty('--ratio', String(picture.width / picture.height));
    const context = this.#picture.getContext('bitmaprenderer');
    if (!context) throw new Error('Canvas bitmap rendering is not available');
    context.transferFromImageBitmap(picture);
    this.#picture.setAttribute('aria-label', name);
    this.#veil.clear();
  }

  /** The picture shown, to copy. */
  get picture(): Picture {
    return { source: this.#picture, ...this.#size };
  }

  /** Veils the picture in the given color, except where the segment's pixels are. */
  highlight(map: SourceMap, segment: number, veil: Srgb): void {
    this.#veil.show(map, segment, veil);
  }

  clear(): void {
    this.#veil.clear();
  }
}

/** A position along a length as a fraction of it, kept within the length. */
function fraction(position: number, length: number): number {
  return Math.min(Math.max(position / length, 0), 1 - Number.EPSILON);
}
