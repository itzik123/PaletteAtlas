import { BAR_FILLS, type BarFill } from './bar-fills.ts';

/**
 * A choice of what each painting's mark shows (see BarFill), as a group of radio buttons drawn as
 * one capsule, so the keyboard and screen readers work as they do for any radio group.
 * Observer: every new choice is reported to the listener.
 */
export class FillPicker {
  readonly element = document.createElement('fieldset');
  readonly #inputs = new Map<BarFill, HTMLInputElement>();

  constructor(onChange: (fill: BarFill) => void) {
    this.element.className = 'fill-picker';
    const legend = document.createElement('legend');
    legend.className = 'visually-hidden';
    legend.textContent = 'What each painting shows';
    this.element.append(legend);
    for (const fill of BAR_FILLS) {
      const option = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'fill';
      input.addEventListener('change', () => onChange(fill));
      this.#inputs.set(fill, input);
      option.append(input, fill.name);
      this.element.append(option);
    }
  }

  /** Shows which fill is picked. */
  select(fill: BarFill): void {
    const input = this.#inputs.get(fill);
    if (input) input.checked = true;
  }
}
