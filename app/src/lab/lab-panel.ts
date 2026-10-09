import type { GalleryEntry } from '../atlas/gallery-data.ts';
import { queryCardElement } from '../atlas/query-card.ts';
import { ATLAS_ICON, UPLOAD_ICON } from '../icons.ts';
import { imageCanvas } from '../image-adapters.ts';
import type { LabQuery } from './lab-query.ts';
import { NearestTiles } from './nearest-tiles.ts';
import type { ReplayControls } from './replay-controls.ts';
import type { SearchReplay } from './search-replay.ts';

/** How many of the nearest paintings the Lab shows: the first row and a half of the Atlas's wall, say. */
export const NEAREST_COUNT = 10;
/** Numbers of layers, in words, for the headline. */
const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** What the panel needs of the Lab around it. */
export interface PanelSetting {
  /** How many layers the index has, and how many paintings. */
  readonly layers: number;
  readonly paintings: number;
  /** Reads the painting at a position in the gallery. */
  readonly entry: (position: number) => Promise<GalleryEntry>;
  /** Asks the visitor for an image of their own. */
  readonly onNewImage: () => void;
}

/**
 * The panel beside the stack: what was searched for, on its card with its color strip and the
 * ways to a new image and to its matches; how many paintings the search has measured so far, of
 * how many; the nearest it has found so far, as the Atlas's tiles; once it ends, whether they are
 * the same as the exact answer's; and the replay's controls.
 */
export class LabPanel {
  readonly element = document.createElement('aside');
  readonly #card: HTMLDivElement;
  readonly #name: HTMLParagraphElement;
  readonly #matches: HTMLAnchorElement;
  readonly #measured: HTMLElement;
  readonly #share: HTMLElement;
  readonly #nearest: NearestTiles;
  readonly #exact: HTMLParagraphElement;
  readonly #paintings: number;
  #beforeMatches: (() => void) | undefined;

  constructor({ layers, paintings, entry, onNewImage }: PanelSetting, controls: ReplayControls) {
    this.#paintings = paintings;
    this.element.className = 'lab-panel';
    this.element.innerHTML = `
      <h1></h1>
      <div class="lab-query">
        <div class="card-place"></div>
        <div class="query-side">
          <p class="query-name"></p>
          <button class="pill" type="button">${UPLOAD_ICON}<span>New image</span></button>
          <a class="pill">${ATLAS_ICON}<span>See the matches</span></a>
        </div>
      </div>
      <div class="measured">
        <p><b>0</b><span>of ${paintings.toLocaleString('en')} measured</span></p>
        <div class="share-bar"><i></i></div>
      </div>
      <section class="nearest" aria-labelledby="nearest-heading">
        <h2 id="nearest-heading">The nearest ${NEAREST_COUNT}</h2>
        <p class="exact-note"></p>
      </section>
    `;
    const $ = <T extends Element>(selector: string): T => this.element.querySelector(selector) as T;
    $('h1').textContent = `Searched in ${NUMBER_WORDS[layers] ?? layers} layers.`;
    this.#card = $('.card-place');
    this.#name = $('.query-name');
    this.#matches = $('a.pill');
    this.#measured = $('.measured b');
    this.#share = $('.share-bar i');
    this.#exact = $('.exact-note');
    this.#nearest = new NearestTiles(NEAREST_COUNT, entry);
    $('.nearest h2').after(this.#nearest.element);
    $('button.pill').addEventListener('click', onNewImage);
    this.#matches.addEventListener('click', () => this.#beforeMatches?.());
    this.element.append(controls.element);
  }

  /** Shows what is searched for, and how its search compares with the exact answer (said once the replay ends). */
  showQuery(query: LabQuery, agreeing: number, exact: number): void {
    const card = queryCardElement(query);
    const strip = imageCanvas(query.colors);
    strip.className = 'card-strip';
    strip.setAttribute('aria-hidden', 'true');
    card.append(strip);
    this.#card.replaceChildren(card);
    this.#name.textContent = query.name;
    this.#matches.href = query.matches;
    this.#beforeMatches = query.beforeMatches;
    this.#exact.innerHTML = '<i class="check" aria-hidden="true">✓</i><span></span>';
    (this.#exact.querySelector('span') as HTMLElement).textContent =
      agreeing === exact ? `The same ${exact} as measuring every painting.` : `${agreeing} of the exact ${exact}.`;
  }

  /** Shows the search as far as it is replayed, and the nearest it has found by then. */
  showProgress(replay: SearchReplay, nearest: readonly number[]): void {
    this.#measured.textContent = replay.measured.toLocaleString('en');
    this.#share.style.width = `${(100 * replay.measured) / this.#paintings}%`;
    this.#exact.classList.toggle('shown', replay.done);
    void this.#nearest.show(nearest);
  }
}
