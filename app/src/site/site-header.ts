import { ATLAS_ICON, GITHUB_ICON, QUESTION_ICON, STUDIO_ICON } from '../icons.ts';
import { careersLink } from './careers-link.ts';
import { ExplainDialog } from './explain-dialog.ts';
import { ATLAS_EXPLANATION, CAREERS_EXPLANATION, type Explanation, PAINTING_EXPLANATION, STUDIO_EXPLANATION } from './explanations.ts';

/** The project's source code. */
const REPOSITORY_URL = 'https://github.com/itzik123/PaletteAtlas';

/** The site's two parts, which the header switches between. */
export type SitePart = 'studio' | 'atlas';

/** The kinds of page on the site. */
export type SitePage = 'studio' | 'atlas' | 'painting' | 'careers';

/** Each kind of page: the part of the site it belongs to, and what "How it works" says on it. */
const PAGES: Readonly<Record<SitePage, { part: SitePart; explanation: Explanation }>> = {
  studio: { part: 'studio', explanation: STUDIO_EXPLANATION },
  atlas: { part: 'atlas', explanation: ATLAS_EXPLANATION },
  painting: { part: 'atlas', explanation: PAINTING_EXPLANATION },
  careers: { part: 'atlas', explanation: CAREERS_EXPLANATION },
};

/** Each part's opening page, where its tab, and the site's name from anywhere in it, lead. */
const HOMES: Readonly<Record<SitePart, string>> = { studio: './', atlas: './atlas.html' };

/**
 * The bar across the top of every page: the site's name, leading to the opening page of the part
 * it is in; a switch between the Studio and the Atlas, and in the Atlas the way to the Career
 * Barcodes; a button that explains the page (see Explanation); and a link to the site's code.
 */
export class SiteHeader {
  readonly element = document.createElement('header');

  constructor(page: SitePage) {
    const { part, explanation } = PAGES[page];
    const dialog = new ExplainDialog(explanation);
    const here = (tab: SitePart): string => (tab === part ? 'aria-current="page"' : '');
    this.element.className = 'site-header';
    this.element.innerHTML = `
      <a class="brand" href="${HOMES[part]}">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        Palette Atlas
      </a>
      <nav class="part-switch" aria-label="Parts of the site">
        <a href="${HOMES.studio}" ${here('studio')}>${STUDIO_ICON}<span>Studio</span></a>
        <a href="${HOMES.atlas}" ${here('atlas')}>${ATLAS_ICON}<span>Atlas</span></a>
      </nav>
      <nav class="site-actions">
        <button class="pill explain-button" type="button">${QUESTION_ICON}<span>How it works</span></button>
        <a class="pill dark" href="${REPOSITORY_URL}" target="_blank" rel="noopener">${GITHUB_ICON}<span>GitHub</span></a>
      </nav>
    `;
    if (part === 'atlas') this.element.querySelector('.part-switch')?.after(careersLink(page === 'careers'));
    this.element.querySelector('.explain-button')?.addEventListener('click', () => dialog.open());
    this.element.append(dialog.element);
  }
}
