import type { AxisName } from '@palette-atlas/strip';
import { iconRadios } from '../icon-radios.ts';
import { AXIS_ICONS } from '../icons.ts';

/** The axes in the order the site lists them, by the names it shows. The first is picked at the start. */
export const AXIS_OPTIONS: readonly { readonly axis: AxisName; readonly label: string }[] = [
  { axis: 'color', label: 'Color' },
  { axis: 'hilbert', label: 'Hilbert' },
  { axis: 'columns', label: 'Columns' },
  { axis: 'radial', label: 'Radial' },
];

/** The name the site shows for an axis. */
export function axisLabel(axis: AxisName): string {
  return AXIS_OPTIONS.find((option) => option.axis === axis)?.label ?? axis;
}

/** A choice of axis, as radio buttons drawn as tiles with an icon each (see iconRadios), which reports every new choice. */
export class AxisPicker {
  readonly element: HTMLFieldSetElement;
  #axis: AxisName = AXIS_OPTIONS[0].axis;

  constructor(onChange: (axis: AxisName) => void) {
    const options = AXIS_OPTIONS.map(({ axis, label }) => ({ value: axis, label, icon: AXIS_ICONS[axis], className: `axis-tile axis-${axis}` }));
    this.element = iconRadios('axis-picker', 'Path through the image', options, this.#axis, (axis) => {
      this.#axis = axis;
      onChange(axis);
    });
  }

  get axis(): AxisName {
    return this.#axis;
  }
}
