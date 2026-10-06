import { BAR_FILLS, type BarFill } from './bar-fills.ts';

/**
 * A choice of what each bar of a career barcode shows (see BarFill), as radio buttons drawn as one
 * capsule, so the keyboard and screen readers work as they do for any radio group.
 * Observer: every new choice is reported to the listener.
 */
export class FillSwitch {
  readonly element = document.createElement('fieldset');

  constructor(picked: BarFill, onChange: (fill: BarFill) => void) {
    this.element.className = 'fill-switch';
    const legend = document.createElement('legend');
    legend.className = 'visually-hidden';
    legend.textContent = 'What each painting’s bar shows';
    this.element.append(legend);
    for (const fill of BAR_FILLS) {
      const option = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'bar-fill';
      input.checked = fill === picked;
      input.addEventListener('change', () => onChange(fill));
      const name = document.createElement('span');
      name.textContent = fill.label;
      option.append(input);
      option.insertAdjacentHTML('beforeend', fill.icon);
      option.append(name);
      this.element.append(option);
    }
  }
}
