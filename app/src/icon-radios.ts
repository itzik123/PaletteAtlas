/** One option of an IconRadios group: what it stands for, the name it shows, its icon, and any classes of its own. */
export interface IconRadio<T> {
  readonly value: T;
  readonly label: string;
  readonly icon: string;
  readonly className?: string;
}

/**
 * A choice among a few options, as radio buttons each drawn with an icon and a name (the page's CSS
 * makes them tiles or one capsule), so the keyboard and screen readers work as they do for any
 * radio group. The legend names the choice for screen readers alone.
 * Observer: every new choice is reported to the listener.
 */
export function iconRadios<T>(
  className: string,
  legend: string,
  options: readonly IconRadio<T>[],
  picked: T,
  onChange: (value: T) => void,
): HTMLFieldSetElement {
  const group = document.createElement('fieldset');
  group.className = className;
  const title = document.createElement('legend');
  title.className = 'visually-hidden';
  title.textContent = legend;
  group.append(title);
  for (const { value, label, icon, className: optionClass } of options) {
    const option = document.createElement('label');
    if (optionClass) option.className = optionClass;
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = className;
    input.checked = value === picked;
    input.addEventListener('change', () => onChange(value));
    const name = document.createElement('span');
    name.textContent = label;
    option.append(input);
    option.insertAdjacentHTML('beforeend', icon);
    option.append(name);
    group.append(option);
  }
  return group;
}
