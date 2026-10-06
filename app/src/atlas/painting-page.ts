import { SOURCE_WIDTH } from '@palette-atlas/gallery';
import { BACK_ICON, OUT_ICON, PAN_ICON, STUDIO_ICON } from '../icons.ts';
import type { StripReader } from '../studio/strip-reader.ts';
import { AxisStrips } from './axis-strips.ts';
import type { GalleryEntry } from './gallery-data.ts';
import { dateOf, lifespanOf, nameOf, titleOf } from './painting-text.ts';
import { PaintingView } from './painting-view.ts';

/** The axis of the strip the gallery stores for every painting. */
const STORED_AXIS = 'color';
/** Paintings at least this many times as wide as they are tall span the page, their details below them. */
const WIDE_ASPECT = 2;
/**
 * Titles longer than these, in characters, are set smaller, and smaller still, so the page fits
 * the screen however long its title: some run to two hundred characters.
 */
const TITLE_LENGTHS = { long: 30, longer: 70 } as const;

/**
 * One painting of the Atlas: the picture large, its details and credit, and its strip along every
 * axis, read in the browser from the same image on Commons that the gallery's strip was read from.
 */
export class PaintingPage {
  readonly element = document.createElement('main');

  constructor(entry: GalleryEntry, reader: StripReader) {
    const { painting, artist, image } = entry;
    const aspect = painting.width / painting.height;
    this.element.className = 'painting-page';
    this.element.dataset.layout = aspect >= WIDE_ASPECT ? 'wide' : 'upright';
    this.element.innerHTML = `
      <a class="pill back" href="./atlas.html">${BACK_ICON}<span>Atlas</span></a>
      <div class="painting-frame">
        <span class="pan-hint" aria-hidden="true">${PAN_ICON}</span>
      </div>
      <section class="painting-info">
        <h1></h1>
        <p class="painting-artist"><b></b> <span></span></p>
        <p class="painting-when"><b class="painting-date"></b> <span class="painting-collection"></span></p>
        <p class="painting-links">
          <span class="chip license">${painting.license === 'cc0' ? 'CC0' : 'Public domain'}</span>
          <a class="chip" href="${image.page}" target="_blank" rel="noopener">Commons${OUT_ICON}</a>
          <a class="chip" href="https://www.wikidata.org/wiki/${painting.id}" target="_blank" rel="noopener">Wikidata${OUT_ICON}</a>
        </p>
      </section>
      <a class="pill dark open-studio" href="./?painting=${painting.id}">${STUDIO_ICON}<span>Open in Studio</span></a>
    `;
    const title = this.element.querySelector('h1')!;
    title.textContent = titleOf(painting);
    const length = titleOf(painting).length;
    title.dataset.length = length > TITLE_LENGTHS.longer ? 'longer' : length > TITLE_LENGTHS.long ? 'long' : 'short';
    this.element.querySelector('.painting-artist b')!.textContent = nameOf(artist);
    this.element.querySelector('.painting-artist span')!.textContent = `(${lifespanOf(artist)})`;
    this.element.querySelector('.painting-date')!.textContent = dateOf(painting);
    this.element.querySelector('.painting-collection')!.textContent = painting.collection ?? '';
    this.element.querySelector('.back')?.addEventListener('click', (event) => {
      // Back to the very place on the wall the visitor came from (see WallPlaces).
      if (cameFromAtlas()) {
        event.preventDefault();
        history.back();
      }
    });

    this.element.querySelector('.painting-frame')?.prepend(new PaintingView(image, aspect, titleOf(painting)).element);

    const strips = new AxisStrips({ axis: STORED_AXIS, colors: entry.strip });
    this.element.querySelector('.open-studio')?.before(strips.element);
    void fetch(image.url(SOURCE_WIDTH))
      .then((response) => (response.ok ? response.blob() : undefined))
      .then((blob) => blob && reader.read(blob))
      .then((read) => {
        if (read) {
          read.picture.close();
          strips.show(read.strips);
        } else {
          strips.done();
        }
      })
      .catch(() => strips.done());
  }
}

/** Whether the visitor came to this page from the Atlas's wall, in this same tab. */
function cameFromAtlas(): boolean {
  if (!document.referrer || history.length < 2) return false;
  const from = new URL(document.referrer);
  return from.origin === location.origin && /\/atlas(\.html)?$/.test(from.pathname);
}
