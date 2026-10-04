import { PALETTE_WORKING_SIZE, type RgbaImage } from '@palette-atlas/color';
import { type AxisName, ImageStrips, PALETTE_SIZE, STRIP_SEGMENTS } from '@palette-atlas/strip';
import type { BenchmarkImage } from './benchmark-images.ts';
import { ColorPicker } from './color-picker.ts';
import { COMPARED_SPACES } from './compared-spaces.ts';
import { GradientRows } from './gradient-rows.ts';
import { Swatch } from './paint.ts';
import { paletteView } from './palette-view.ts';
import { shrinkComparison } from './shrink-comparison.ts';
import { SourceHighlight, StripRow } from './strip-view.ts';

/** How each axis is labeled beside its strip. */
const AXIS_LABELS: Readonly<Record<AxisName, string>> = {
  columns: 'Columns',
  radial: 'Radial',
  hilbert: 'Hilbert',
  color: 'Color',
};

/**
 * One benchmark image with the libraries' output for it: its mean color and a gradient between
 * two picked colors in every compared space, the shrink for k-means and the resulting palette,
 * and a strip along every axis, linked to the image by hovering.
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
    const highlight = new SourceHighlight();
    const frame = document.createElement('div');
    frame.className = 'image-frame';
    frame.append(picker.element, highlight.element);

    // Everything below works on the shrunk image, which keeps the light of every region.
    const { shrunk, palette, strips: namedStrips } = ImageStrips.read(image);
    const strips = document.createElement('div');
    strips.className = 'strips';
    for (const { axis, strip } of namedStrips) {
      const onHover = (segment: number | undefined): void =>
        segment === undefined ? highlight.clear() : highlight.show(strip.sourceMap, segment);
      strips.append(new StripRow(AXIS_LABELS[axis], strip, onHover).element);
    }

    const checks = document.createElement('div');
    checks.className = 'checks';
    checks.append(
      check('Average of all pixels', averages),
      check('Gradient from A to B', gradients.element),
      check(`Shrunk to ${PALETTE_WORKING_SIZE} px`, shrinkComparison(image, shrunk)),
      check(`Palette: k-means in OKLab, ${PALETTE_SIZE} colors`, paletteView(palette)),
      check(`Strips, ${STRIP_SEGMENTS} segments: hover to see each one's source`, strips),
    );

    this.element.className = 'card';
    this.element.append(title, frame, checks);
  }
}

function check(heading: string, content: HTMLElement): HTMLElement {
  const title = document.createElement('h3');
  title.textContent = heading;
  const element = document.createElement('div');
  element.append(title, content);
  return element;
}
