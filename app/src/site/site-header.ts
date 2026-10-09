import { ATLAS_ICON, GITHUB_ICON, LAB_ICON, QUESTION_ICON, STUDIO_ICON } from '../icons.ts';
import { careersLink } from './careers-link.ts';
import { ExplainDialog } from './explain-dialog.ts';
import {
  ATLAS_EXPLANATION,
  CAREERS_EXPLANATION,
  type Explanation,
  LAB_EXPLANATION,
  PAINTING_EXPLANATION,
  STUDIO_EXPLANATION,
} from './explanations.ts';

/** The project's source code. */
const REPOSITORY_URL = 'https://github.com/itzik123/PaletteAtlas';

/** The site's three parts, which the header switches between. */
export type SitePart = 'studio' | 'atlas' | 'lab';

/** The kinds of page on the site. */
export type SitePage = 'studio' | 'atlas' | 'painting' | 'careers' | 'lab';

/**
 * Each kind of page: the part of the site it belongs to, what "How it works" says on it, and
 * whether its header leads to the Career Barcodes.
 */
const PAGES: Readonly<Record<SitePage, { part: SitePart; explanation: Explanation; careers: boolean }>> = {
  studio: { part: 'studio', explanation: STUDIO_EXPLANATION, careers: false },
  atlas: { part: 'atlas', explanation: ATLAS_EXPLANATION, careers: true },
  // A painting's page leads to its own artist's Career Barcode instead, from beside their name.
  painting: { part: 'atlas', explanation: PAINTING_EXPLANATION, careers: false },
  careers: { part: 'atlas', explanation: CAREERS_EXPLANATION, careers: true },
  lab: { part: 'lab', explanation: LAB_EXPLANATION, careers: false },
};

/** Each part's opening page, where its tab, and the site's name from anywhere in it, lead. */
const HOMES: Readonly<Record<SitePart, string>> = { studio: './', atlas: './atlas.html', lab: './lab.html' };

/**
 * The bar across the top of every page: the site's name, leading to the opening page of the part
 * it is in; a switch between the Studio, the Atlas and the Lab, and on the Atlas's wall and the Career
 * Barcodes the way to them; a button that explains the page (see Explanation); and a link to the
 * site's code.
 */
export class SiteHeader {
  readonly element = document.createElement('header');

  constructor(page: SitePage) {
    const { part, explanation, careers } = PAGES[page];
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
        <a href="${HOMES.lab}" ${here('lab')}>${LAB_ICON}<span>Lab</span></a>
      </nav>
      <nav class="site-actions">
        <button class="pill explain-button" type="button">${QUESTION_ICON}<span>How it works</span></button>
        <a class="pill dark" href="${REPOSITORY_URL}" target="_blank" rel="noopener">${GITHUB_ICON}<span>GitHub</span></a>
      </nav>
    `;
    if (careers) this.element.querySelector('.part-switch')?.after(careersLink(page === 'careers'));
    this.element.querySelector('.explain-button')?.addEventListener('click', () => dialog.open());
    this.element.append(dialog.element);
  }
}
