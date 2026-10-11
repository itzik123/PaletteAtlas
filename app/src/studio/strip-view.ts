import type { Srgb } from '@palette-atlas/color';
import type { Strip } from '@palette-atlas/strip';
import { ArrowSteps } from '../arrow-steps.ts';
import { paintImage } from '../image-adapters.ts';

/**
 * The strip, drawn big, with a marker that pins one segment and shows its color in a bubble.
 * Observer: pointing at the strip reports the segment under the pointer, and leaving it reports
 * undefined; so do its arrow keys (see ArrowSteps), stripe by stripe.
 */
export class StripView {
  readonly element = document.createElement('div');
  readonly #canvas = document.createElement('canvas');
  readonly #marker = document.createElement('div');
  readonly #steps: ArrowSteps;
  #segments = 0;

  constructor(onPoint: (segment: number | undefined) => void) {
    this.element.className = 'strip-stack';
    this.#canvas.className = 'studio-strip';
    this.#steps = new ArrowSteps(this.#canvas, {
      name: 'Strip',
      onStep: onPoint,
      describe: (segment) => (segment === undefined ? `${this.#segments} stripes` : `Stripe ${segment + 1} of ${this.#segments}`),
    });
    this.#marker.className = 'segment-marker';
    this.#marker.setAttribute('aria-hidden', 'true');
    this.#marker.hidden = true;
    this.element.append(this.#canvas, this.#marker);

    // offsetX is measured inside the canvas's border, across its clientWidth.
    const report = (event: PointerEvent): void => {
      const position = Math.floor((event.offsetX / this.#canvas.clientWidth) * this.#segments);
      onPoint(Math.min(Math.max(position, 0), this.#segments - 1));
    };
    this.#canvas.addEventListener('pointermove', report);
    this.#canvas.addEventListener('pointerdown', report);
    this.#canvas.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') onPoint(undefined);
    });
  }

  show(strip: Strip): void {
    this.#segments = strip.segmentCount;
    paintImage(this.#canvas, strip.toImage());
    this.#steps.setCount(this.#segments);
    this.unmark();
  }

  /** Pins a segment, showing its color, or none for a segment without visible pixels. */
  mark(segment: number, color: Srgb | undefined): void {
    this.#marker.style.setProperty('--at', String(segment / this.#segments));
    this.#marker.style.setProperty('--span', String(1 / this.#segments));
    this.#marker.style.setProperty('--color', color?.toHex() ?? 'transparent');
    this.#marker.hidden = false;
    this.#steps.show(segment);
  }

  unmark(): void {
    this.#marker.hidden = true;
    this.#steps.show(undefined);
  }
}
