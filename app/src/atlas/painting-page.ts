import { type Artist, SOURCE_WIDTH } from '@palette-atlas/gallery';
import { fetchOk } from '../fetching.ts';
import { BACK_ICON, BARCODE_ICON, OUT_ICON, PAN_ICON, STUDIO_ICON } from '../icons.ts';
import type { StripReader } from '../studio/strip-reader.ts';
import { AxisStrips } from './axis-strips.ts';
import type { GalleryEntry } from './gallery-data.ts';
import { dateOf, lifespanOf, nameOf, titleOf } from './painting-text.ts';
import { PaintingView } from './painting-view.ts';
import { PictureLightbox } from './picture-lightbox.ts';
import { SameColors } from './same-colors.ts';

/** What the site calls an artist's page. */
const CAREER_BARCODE = 'Career Barcode';
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
 * One painting of the Atlas: the picture large, the ways back to the Atlas and on to the Studio,
 * its details and credit, its strip along every axis, read in the browser from the same image on
 * Commons that the gallery's strip was read from, and the paintings nearest its colors (see
 * SameColors). Beside the artist's name, a button leads to their Career Barcode, if they have one.
 */
export class PaintingPage {
  readonly element = document.createElement('main');

  constructor(entry: GalleryEntry, reader: StripReader, hasCareer: boolean, sameColors: Promise<readonly GalleryEntry[]>) {
    const { painting, artist, image } = entry;
    const aspect = painting.width / painting.height;
    this.element.className = 'painting-page';
    this.element.dataset.layout = aspect >= WIDE_ASPECT ? 'wide' : 'upright';
    this.element.innerHTML = `
      <div class="painting-nav">
        <a class="pill back" href="./atlas.html">${BACK_ICON}<span>Atlas</span></a>
        <a class="pill dark open-studio" href="./?painting=${painting.id}">${STUDIO_ICON}<span>Open in Studio</span></a>
      </div>
      <div class="painting-frame">
        <span class="pan-hint" aria-hidden="true">${PAN_ICON}</span>
      </div>
      <section class="painting-info">
        <h1></h1>
        <div class="painting-byline"><p class="painting-artist"><b></b> <span></span></p></div>
        <p class="painting-when"><b class="painting-date"></b> <span class="painting-collection"></span></p>
        <p class="painting-links">
          <span class="chip license">${painting.license === 'cc0' ? 'CC0' : 'Public domain'}</span>
          <a class="chip" href="${image.page}" target="_blank" rel="noopener">Commons${OUT_ICON}</a>
          <a class="chip" href="https://www.wikidata.org/wiki/${painting.id}" target="_blank" rel="noopener">Wikidata${OUT_ICON}</a>
        </p>
      </section>
    `;
    const title = this.element.querySelector('h1')!;
    title.textContent = titleOf(painting);
    const length = titleOf(painting).length;
    title.dataset.length = length > TITLE_LENGTHS.longer ? 'longer' : length > TITLE_LENGTHS.long ? 'long' : 'short';
    this.element.querySelector('.painting-artist b')!.textContent = nameOf(artist);
    this.element.querySelector('.painting-artist span')!.textContent = `(${lifespanOf(artist)})`;
    if (hasCareer) this.element.querySelector('.painting-byline')?.append(careerLink(artist));
    this.element.querySelector('.painting-date')!.textContent = dateOf(painting);
    this.element.querySelector('.painting-collection')!.textContent = painting.collection ?? '';
    this.element.querySelector('.back')?.addEventListener('click', (event) => {
      // Back to the very place on the wall the visitor came from (see WallPlaces).
      if (cameFromAtlas()) {
        event.preventDefault();
        history.back();
      }
    });

    const frame = this.element.querySelector<HTMLElement>('.painting-frame')!;
    const view = new PaintingView(image, aspect, titleOf(painting));
    frame.prepend(view.element);
    const enlarged = new PictureLightbox(image, aspect, titleOf(painting), painting.id);
    enlarged.openFrom(view.element);
    this.element.append(enlarged.element);

    const strips = new AxisStrips({ axis: STORED_AXIS, colors: entry.strip });
    // Down to the foot of the picture's card beside it; under a wide one, to the foot of the screen,
    // less the room below the page and the gap before the grid's last row, under the details.
    const bottom = (): number => {
      if (this.element.dataset.layout === 'upright') return frame.getBoundingClientRect().bottom + scrollY;
      const style = getComputedStyle(this.element);
      return innerHeight - Number.parseFloat(style.paddingBottom) - Number.parseFloat(style.rowGap);
    };
    const same = new SameColors(painting.id, sameColors, bottom);
    const info = this.element.querySelector('.painting-info')!;
    info.after(strips.element, same.element);
    // The room left changes with the picture's card and the details above (the window resized, say).
    const resized = new ResizeObserver(() => same.fit());
    resized.observe(frame);
    resized.observe(info);
    void fetchOk(image.url(SOURCE_WIDTH))
      .then(async (response) => reader.read(await response.blob()))
      .catch(() => undefined)
      .then((read) => {
        read?.picture.close();
        strips.show(read?.strips);
      });
  }
}

/** The way to an artist's Career Barcode: a barcode, named in a tooltip while pointed at. */
function careerLink(artist: Artist): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'career-link';
  link.href = `./artist.html?id=${artist.id}`;
  link.setAttribute('aria-label', CAREER_BARCODE);
  link.innerHTML = `${BARCODE_ICON}<span class="tooltip" aria-hidden="true">${CAREER_BARCODE}</span>`;
  return link;
}

/** Whether the visitor came to this page from the Atlas's wall, in this same tab. */
function cameFromAtlas(): boolean {
  if (!document.referrer || history.length < 2) return false;
  const from = new URL(document.referrer);
  return from.origin === location.origin && /\/atlas(\.html)?$/.test(from.pathname);
}
