import type { RgbaImage } from '@palette-atlas/color';
import type { BenchmarkImage } from './benchmark-images.ts';
import { ColorPicker } from './color-picker.ts';
import { COMPARED_SPACES } from './compared-spaces.ts';
import { GradientRows } from './gradient-rows.ts';
import { Swatch } from './paint.ts';

/**
 * One benchmark image with the color library's output for it: the mean color of all its
 * pixels and a gradient between two picked colors, each in every compared space.
 */
export class BenchmarkCard {
  readonly element = document.createElement('section');

  constructor(entry: BenchmarkImage, image: RgbaImage) {
    const title = document.createElement('h2');
    const size = document.createElement('small');
    size.textContent = `${image.width} × ${image.height}`;
    title.append(`${entry.name} `, size);

    const averages = document.createElement('div');
    averages.className = 'swatches';
    averages.append(...COMPARED_SPACES.map((space) => new Swatch(space.name, space.average(image)).element));

    const gradients = new GradientRows();
    const picker = new ColorPicker(entry.url, image, entry.picks, (from, to) => gradients.show(from, to));

    const checks = document.createElement('div');
    checks.className = 'checks';
    checks.append(check('Average of all pixels', averages), check('Gradient from A to B', gradients.element));

    this.element.className = 'card';
    this.element.append(title, picker.element, checks);
  }
}

function check(heading: string, content: HTMLElement): HTMLElement {
  const title = document.createElement('h3');
  title.textContent = heading;
  const element = document.createElement('div');
  element.append(title, content);
  return element;
}
