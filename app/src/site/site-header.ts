import { ATLAS_ICON, GITHUB_ICON, QUESTION_ICON, STUDIO_ICON } from '../icons.ts';
import { ExplainDialog } from './explain-dialog.ts';

/** The project's source code. */
const REPOSITORY_URL = 'https://github.com/itzik123/PaletteAtlas';

/** The site's two parts, which the header switches between. */
export type SitePart = 'studio' | 'atlas';

/**
 * The bar across the top of every page: the name, a switch between the Studio and the Atlas, a
 * button that explains the site, and a link to its code.
 */
export class SiteHeader {
  readonly element = document.createElement('header');

  constructor(current: SitePart) {
    const dialog = new ExplainDialog();
    const here = (part: SitePart): string => (part === current ? 'aria-current="page"' : '');
    this.element.className = 'site-header';
    this.element.innerHTML = `
      <a class="brand" href="./">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        Palette Atlas
      </a>
      <nav class="part-switch" aria-label="Parts of the site">
        <a href="./" ${here('studio')}>${STUDIO_ICON}<span>Studio</span></a>
        <a href="./atlas.html" ${here('atlas')}>${ATLAS_ICON}<span>Atlas</span></a>
      </nav>
      <nav class="site-actions">
        <button class="pill explain-button" type="button">${QUESTION_ICON}<span>How it works</span></button>
        <a class="pill dark" href="${REPOSITORY_URL}" target="_blank" rel="noopener">${GITHUB_ICON}<span>GitHub</span></a>
      </nav>
    `;
    this.element.querySelector('.explain-button')?.addEventListener('click', () => dialog.open());
    this.element.append(dialog.element);
  }
}
