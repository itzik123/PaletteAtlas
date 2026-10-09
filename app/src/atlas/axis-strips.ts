import type { RgbaImage } from '@palette-atlas/color';
import type { AxisName, NamedStrip } from '@palette-atlas/strip';
import { AXIS_ICONS } from '../icons.ts';
import { imageCanvas } from '../image-adapters.ts';
import { AXIS_OPTIONS, axisLabel } from '../studio/axis-picker.ts';

/**
 * A painting's strip along every axis, one under another, each beside its axis's icon. The color
 * strip the gallery stored shows at once; the browser reads all four from the image meanwhile.
 */
export class AxisStrips {
  readonly element = document.createElement('div');
  readonly #rows = new Map<AxisName, HTMLElement>();

  constructor(stored: { readonly axis: AxisName; readonly colors: RgbaImage }) {
    this.element.className = 'axis-strips';
    this.element.setAttribute('aria-busy', 'true');
    for (const { axis, label } of AXIS_OPTIONS) {
      const row = document.createElement('div');
      row.className = `axis-strip axis-${axis}`;
      row.innerHTML = `<span class="axis-badge" title="${label}">${AXIS_ICONS[axis]}</span><span class="strip-slot"></span>`;
      this.#rows.set(axis, row);
      this.element.append(row);
    }
    this.#draw(stored.axis, stored.colors);
  }

  /** Shows the strips the browser read, if it could read them, and ends the wait. */
  show(strips: readonly NamedStrip[] = []): void {
    for (const { axis, strip } of strips) this.#draw(axis, strip.toImage());
    this.element.removeAttribute('aria-busy');
  }

  #draw(axis: AxisName, colors: RgbaImage): void {
    const canvas = imageCanvas(colors);
    canvas.className = 'axis-strip-band';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${axisLabel(axis)} strip`);
    this.#rows.get(axis)?.querySelector('.strip-slot')?.replaceChildren(canvas);
  }
}
