import { CLOSE_ICON } from '../icons.ts';
import type { Explanation, ExplainStep } from './explanations.ts';

/** The id of the dialog's title, which names the dialog. */
const TITLE_ID = 'explain-title';

/**
 * A short, visual explanation of the page it is on (see Explanation), in a dialog that closes with
 * its button, Escape or a click outside.
 */
export class ExplainDialog {
  readonly element = document.createElement('dialog');

  constructor({ title, steps, credits }: Explanation) {
    this.element.className = 'explain';
    this.element.setAttribute('aria-labelledby', TITLE_ID);
    const form = document.createElement('form');
    form.method = 'dialog';
    form.innerHTML = `<button class="close" aria-label="Close">${CLOSE_ICON}</button>`;
    const heading = document.createElement('h2');
    heading.id = TITLE_ID;
    heading.textContent = title;
    const list = document.createElement('ol');
    list.append(...steps.map(stepItem));
    const credit = document.createElement('p');
    credit.className = 'credits';
    credit.textContent = credits;
    this.element.append(form, heading, list, credit);
    // A click on the backdrop lands on the dialog itself, but outside its box.
    this.element.addEventListener('click', (event) => {
      if (event.target === this.element && !within(this.element.getBoundingClientRect(), event)) this.element.close();
    });
  }

  open(): void {
    this.element.showModal();
  }
}

/** A step: its icon on a colored disc, beside its words. */
function stepItem({ icon, disc, lead, rest }: ExplainStep): HTMLLIElement {
  const item = document.createElement('li');
  const badge = document.createElement('span');
  badge.className = `step-icon ${disc}`;
  badge.innerHTML = icon;
  const text = document.createElement('p');
  const bold = document.createElement('b');
  bold.textContent = lead;
  text.append(bold, ` ${rest}`);
  item.append(badge, text);
  return item;
}

function within(box: DOMRect, { clientX, clientY }: MouseEvent): boolean {
  return clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom;
}
