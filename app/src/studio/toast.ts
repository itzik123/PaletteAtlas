/** How long a message stays up. */
const SHOW_MS = 4500;

/** A short message that pops up at the bottom of the page and goes away by itself. */
export class Toast {
  readonly element = document.createElement('p');
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.element.className = 'toast';
    this.element.setAttribute('role', 'alert');
    this.element.hidden = true;
  }

  show(text: string): void {
    this.element.textContent = text;
    this.element.hidden = false;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.hide(), SHOW_MS);
  }

  hide(): void {
    clearTimeout(this.#timer);
    this.element.hidden = true;
  }
}
