import type { AxisName } from '@palette-atlas/strip';
import { AXIS_ICONS } from '../icons.ts';

/** The axes in the order the picker offers them, by the names the Studio shows. The first is picked at the start. */
const AXIS_OPTIONS: readonly { readonly axis: AxisName; readonly label: string }[] = [
  { axis: 'color', label: 'Color' },
  { axis: 'hilbert', label: 'Hilbert' },
  { axis: 'columns', label: 'Columns' },
  { axis: 'radial', label: 'Radial' },
];

/**
 * A choice of axis, as a group of radio buttons drawn as tiles with an icon each, so the
 * keyboard and screen readers work as they do for any radio group.
 * Observer: every new choice is reported to the listener.
 */
export class AxisPicker {
  readonly element = document.createElement('fieldset');
  #axis: AxisName = AXIS_OPTIONS[0].axis;

  constructor(onChange: (axis: AxisName) => void) {
    this.element.className = 'axis-picker';
    const legend = document.createElement('legend');
    legend.className = 'visually-hidden';
    legend.textContent = 'Path through the image';
    this.element.append(legend);
    for (const { axis, label } of AXIS_OPTIONS) {
      const tile = document.createElement('label');
      tile.className = `axis-tile axis-${axis}`;
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'axis';
      input.value = axis;
      input.checked = axis === this.#axis;
      input.addEventListener('change', () => {
        this.#axis = axis;
        onChange(axis);
      });
      const name = document.createElement('span');
      name.textContent = label;
      tile.append(input);
      tile.insertAdjacentHTML('beforeend', AXIS_ICONS[axis]);
      tile.append(name);
      this.element.append(tile);
    }
  }

  get axis(): AxisName {
    return this.#axis;
  }
}
