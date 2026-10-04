import type { Srgb } from '@palette-atlas/color';
import { COMPARED_SPACES } from './compared-spaces.ts';
import { paintGradient, Swatch } from './paint.ts';

/** Colors per gradient: one per canvas column, stretched to the row's width. */
const GRADIENT_STEPS = 256;

/** The gradient between two colors in every compared space, one row above the other. */
export class GradientRows {
  readonly element = document.createElement('div');
  readonly #from = new Swatch('A');
  readonly #to = new Swatch('B');
  readonly #rows = COMPARED_SPACES.map((space) => ({ space, canvas: document.createElement('canvas') }));

  constructor() {
    this.element.className = 'gradients';
    const ends = document.createElement('div');
    ends.className = 'swatches';
    ends.append(this.#from.element, this.#to.element);
    this.element.append(ends);
    for (const { space, canvas } of this.#rows) {
      canvas.width = GRADIENT_STEPS;
      canvas.height = 1;
      const label = document.createElement('span');
      label.textContent = space.name;
      const row = document.createElement('div');
      row.className = 'gradient-row';
      row.append(label, canvas);
      this.element.append(row);
    }
  }

  show(from: Srgb, to: Srgb): void {
    this.#from.show(from);
    this.#to.show(to);
    for (const { space, canvas } of this.#rows) paintGradient(canvas, space.gradient(from, to));
  }
}
