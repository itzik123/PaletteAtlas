import { GITHUB_ICON, QUESTION_ICON } from '../icons.ts';
import { ExplainDialog } from './explain-dialog.ts';

/** The project's source code. */
const REPOSITORY_URL = 'https://github.com/itzik123/PaletteAtlas';

/** The bar across the top of every page: the name, a button that explains the site, and a link to its code. */
export class SiteHeader {
  readonly element = document.createElement('header');

  constructor() {
    const dialog = new ExplainDialog();
    this.element.className = 'site-header';
    this.element.innerHTML = `
      <a class="brand" href="./">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        Palette Atlas
      </a>
      <nav class="site-actions">
        <button class="pill explain-button" type="button">${QUESTION_ICON}<span>How it works</span></button>
        <a class="pill dark" href="${REPOSITORY_URL}" target="_blank" rel="noopener">${GITHUB_ICON}<span>GitHub</span></a>
      </nav>
    `;
    this.element.querySelector('.explain-button')?.addEventListener('click', () => dialog.open());
    this.element.append(dialog.element);
  }
}
