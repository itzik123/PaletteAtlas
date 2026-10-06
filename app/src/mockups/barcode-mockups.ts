import { type GalleryEntry, GalleryData } from '../atlas/gallery-data.ts';
import { lifespanOf, nameOf } from '../atlas/painting-text.ts';
import { RETRY_ICON } from '../icons.ts';
import { type ArtistChoice, ArtistPicker } from './artist-picker.ts';
import { BAR_FILLS, type BarFill } from './bar-fills.ts';
import type { BarcodeDesign } from './barcode-design.ts';
import { BarcodeView } from './barcode-view.ts';
import { Career } from './career.ts';
import { FillPicker } from './fill-picker.ts';
import { SequenceDesign } from './sequence-design.ts';
import { SkylineDesign } from './skyline-design.ts';
import { TimelineDesign } from './timeline-design.ts';

/** The designs, in the order the page shows them. */
const DESIGNS: readonly BarcodeDesign[] = [new SequenceDesign(), new TimelineDesign(), new SkylineDesign()];
/** The artist shown first, unless the address names another: Van Gogh, whose palette changed most in the fewest years. */
const FIRST_ARTIST = 'Q5582';

/**
 * The mockups of the artist pages' career barcodes: one artist's career drawn in every design,
 * one under another, with a choice of artist and of what each painting's mark shows. The address
 * keeps both (?artist=Q5582&fill=average), to come back to or share.
 *
 * It loads the whole gallery to find each artist's paintings, as no page of the site would: the
 * artist pages will have data of their own.
 */
export class BarcodeMockups {
  readonly element = document.createElement('main');
  readonly #status = document.createElement('p');
  readonly #controls = document.createElement('div');
  readonly #name = document.createElement('h2');
  readonly #facts = document.createElement('p');
  readonly #views = DESIGNS.map((design) => new BarcodeView(design));
  readonly #fills = new FillPicker((fill) => this.#show(this.#artist, fill));
  /** Each artist's paintings in gallery order, by the artist's Wikidata item. */
  readonly #paintings = new Map<string, GalleryEntry[]>();
  #picker: ArtistPicker | undefined;
  #artist = FIRST_ARTIST;
  #fill: BarFill = BAR_FILLS[0];

  constructor() {
    this.element.className = 'mockups';
    this.element.innerHTML = `
      <h1>Career barcodes</h1>
      <p class="mockups-note">Mockups for the artist pages: three ways to draw a career from its paintings’ color strips,
        oldest first. Point at a painting to see which it is; click to open it.</p>
    `;
    this.#status.className = 'mockups-status';
    this.#controls.className = 'mockups-controls';
    const head = document.createElement('header');
    head.className = 'artist-head';
    head.append(this.#name, this.#facts);
    this.element.append(this.#status, this.#controls, head, ...this.#views.map(({ element }) => element));
  }

  /** Loads the gallery, then shows the artist and fill the address names, or the first ones. */
  async load(): Promise<void> {
    this.element.setAttribute('aria-busy', 'true');
    this.#status.replaceChildren('Loading the gallery…');
    const entries = await GalleryData.load()
      .then(async (data) => {
        this.#status.replaceChildren(`Loading all ${data.count.toLocaleString('en')} paintings…`);
        return data.entries(0, data.count);
      })
      .catch(() => undefined);
    this.element.removeAttribute('aria-busy');
    if (!entries) {
      this.#status.replaceChildren('The gallery didn’t load. Run pnpm paintings, or ', this.#retryButton());
      return;
    }
    this.#status.remove();
    for (const entry of entries) {
      const paintings = this.#paintings.get(entry.artist.id);
      if (paintings) paintings.push(entry);
      else this.#paintings.set(entry.artist.id, [entry]);
    }
    // The most prolific first: the careers with the most to show.
    const choices: ArtistChoice[] = [...this.#paintings.values()]
      .map((paintings) => ({ artist: paintings[0].artist, paintings: paintings.length }))
      .sort((a, b) => b.paintings - a.paintings);
    this.#picker = new ArtistPicker(choices, (id) => this.#show(id, this.#fill));
    this.#controls.append(this.#picker.element, this.#fills.element);

    const address = new URLSearchParams(location.search);
    const artist = address.get('artist') ?? FIRST_ARTIST;
    const fill = BAR_FILLS.find(({ name }) => name.toLowerCase() === address.get('fill')) ?? this.#fill;
    this.#show(this.#paintings.has(artist) ? artist : FIRST_ARTIST, fill);
  }

  #show(id: string, fill: BarFill): void {
    const paintings = this.#paintings.get(id);
    if (!paintings) return;
    this.#artist = id;
    this.#fill = fill;
    this.#picker?.select(id);
    this.#fills.select(fill);
    history.replaceState(null, '', `?artist=${id}&fill=${fill.name.toLowerCase()}`);

    const career = new Career(paintings[0].artist, paintings);
    const { artist } = career;
    this.#name.textContent = nameOf(artist);
    this.#facts.textContent =
      `${lifespanOf(artist)} · ${career.paintings.length} of ${paintings.length} ` +
      `${paintings.length === 1 ? 'painting' : 'paintings'} dated closely enough to place`;
    const colors = career.paintings.map(({ entry }) => fill.colors(entry.strip));
    for (const view of this.#views) view.show(career, colors);
  }

  #retryButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pill';
    button.innerHTML = `${RETRY_ICON}<span>try again</span>`;
    button.addEventListener('click', () => void this.load());
    return button;
  }
}
