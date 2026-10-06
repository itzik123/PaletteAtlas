import { BACK_ICON } from '../icons.ts';
import { BAR_FILLS } from './bar-fills.ts';
import { CareerBarcode } from './career-barcode.ts';
import { FillSwitch } from './fill-switch.ts';
import type { Career } from './gallery-data.ts';
import { lifespanOf, nameOf } from './painting-text.ts';

/** Names longer than this, in characters, are set smaller: the longest run to sixty. */
const LONG_NAME = 28;

/**
 * An artist's page: their name and years, and their Career Barcode (see CareerBarcode), every
 * painting of theirs dated closely enough to place, oldest first, each showing its color strip or
 * its average color as the switch above it says: the strip at first.
 */
export class ArtistPage {
  readonly element = document.createElement('main');

  constructor(career: Career) {
    const { artist, paintings } = career;
    this.element.className = 'artist-page';
    this.element.innerHTML = `
      <a class="pill back" href="./atlas.html">${BACK_ICON}<span>Atlas</span></a>
      <h1></h1>
      <p class="artist-facts"><b></b> <span></span></p>
    `;
    const name = this.element.querySelector('h1')!;
    name.textContent = nameOf(artist);
    name.toggleAttribute('data-long', nameOf(artist).length > LONG_NAME);
    this.element.querySelector('.artist-facts b')!.textContent = lifespanOf(artist);
    this.element.querySelector('.artist-facts span')!.textContent =
      `${paintings.length.toLocaleString('en')} ${paintings.length === 1 ? 'painting' : 'paintings'}`;

    const fill = BAR_FILLS[0];
    const barcode = new CareerBarcode(career, fill);
    const fills = new FillSwitch(fill, (picked) => barcode.show(picked));
    this.element.append(fills.element, barcode.element);
  }
}
