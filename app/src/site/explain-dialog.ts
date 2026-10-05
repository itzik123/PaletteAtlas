import { AXIS_ICONS, CLOSE_ICON, UPLOAD_ICON } from '../icons.ts';

/** A short, visual explanation of the Studio, in a dialog that closes with its button, Escape or a click outside. */
export class ExplainDialog {
  readonly element = document.createElement('dialog');

  constructor() {
    this.element.className = 'explain';
    this.element.setAttribute('aria-labelledby', 'explain-title');
    this.element.innerHTML = `
      <form method="dialog">
        <button class="close" aria-label="Close">${CLOSE_ICON}</button>
      </form>
      <h2 id="explain-title">How it works</h2>
      <ol>
        <li>
          <span class="step-icon red">${UPLOAD_ICON}</span>
          <p><b>Drop in any image.</b> It never leaves your computer.</p>
        </li>
        <li>
          <span class="step-icon blue">${AXIS_ICONS.hilbert}</span>
          <p><b>Pick a path through it:</b> by color, along a Hilbert curve, in columns, or out from the center.</p>
        </li>
        <li>
          <span class="step-icon yellow"><span class="mini-strip"></span></span>
          <p><b>The path becomes 128 stripes,</b> each the true average light of the pixels it passes.</p>
        </li>
      </ol>
    `;
    // A click on the backdrop lands on the dialog itself, but outside its box.
    this.element.addEventListener('click', (event) => {
      if (event.target === this.element && !within(this.element.getBoundingClientRect(), event)) this.element.close();
    });
  }

  open(): void {
    this.element.showModal();
  }
}

function within(box: DOMRect, { clientX, clientY }: MouseEvent): boolean {
  return clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom;
}
