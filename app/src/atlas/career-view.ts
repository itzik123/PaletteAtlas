import type { Artist } from '@palette-atlas/gallery';
import { iconRadios } from '../icon-radios.ts';
import { RETRY_ICON } from '../icons.ts';
import { BAR_FILLS, type BarFill } from './bar-fills.ts';
import { CareerBarcode } from './career-barcode.ts';
import type { Career, Painter } from './gallery-data.ts';
import { lifespanOf, nameOf, paintingCount } from './painting-text.ts';

/** The smallest a name is set to fit it on one line, in CSS pixels: a name too long even then wraps. */
const LEAST_NAME_SIZE = 26;

/** What the career's place shows: the barcode, the barcode waiting for a career on its way, or word that it failed to arrive. */
type Stage = 'shown' | 'waiting' | 'failed';

/**
 * An artist's career: their name and years, and their Career Barcode (see CareerBarcode), every
 * painting of theirs dated closely enough to place, oldest first, each showing its color strip or
 * its average color as the switch above it says: the strip at first, then whichever was picked
 * last, from artist to artist. The name is set as large as fits on one line, so that from artist
 * to artist the barcode keeps its place.
 */
export class CareerView {
  readonly element = document.createElement('section');
  readonly #name = document.createElement('h1');
  readonly #lifespan = document.createElement('b');
  readonly #count = document.createElement('span');
  readonly #barcode = new CareerBarcode();
  /** In the barcode's place when a career fails to arrive. */
  readonly #trouble = document.createElement('div');
  #fill: BarFill = BAR_FILLS[0];
  #career: Career | undefined;
  #retry: (() => void) | undefined;

  constructor() {
    this.element.className = 'career-view';
    const facts = document.createElement('p');
    facts.className = 'artist-facts';
    facts.append(this.#lifespan, ' ', this.#count);
    // What each bar shows, picked on a switch drawn as one capsule.
    const fillOptions = BAR_FILLS.map((fill) => ({ value: fill, label: fill.label, icon: fill.icon }));
    const fills = iconRadios('fill-switch', 'What each painting’s bar shows', fillOptions, this.#fill, (fill) => {
      this.#fill = fill;
      if (this.#career) this.#barcode.show(this.#career, fill);
    });
    this.#trouble.className = 'career-trouble';
    this.#trouble.innerHTML = `<p>This career didn’t load.</p><button type="button" class="pill">${RETRY_ICON}<span>Try again</span></button>`;
    this.#trouble.querySelector('button')?.addEventListener('click', () => this.#retry?.());
    this.element.append(this.#name, facts, fills, this.#barcode.element, this.#trouble);
    this.#stage('shown');

    new ResizeObserver(() => this.#fitName()).observe(this.#name);
    // The name's typeface changes its width as it arrives.
    void document.fonts.ready.then(() => this.#fitName());
  }

  /** Shows an artist's career. */
  show(career: Career): void {
    this.#career = career;
    this.#introduce(career.artist, career.paintings.length);
    this.#barcode.show(career, this.#fill);
    this.#stage('shown');
  }

  /** Shows an artist at once, their barcode waiting for their career to arrive. */
  wait({ artist, paintings }: Painter): void {
    this.#introduce(artist, paintings);
    this.#stage('waiting');
  }

  /** Says that the career on its way failed to arrive, with a button to ask for it again. */
  fail(retry: () => void): void {
    this.#retry = retry;
    this.#stage('failed');
  }

  #introduce(artist: Artist, paintings: number): void {
    this.#name.textContent = nameOf(artist);
    this.#lifespan.textContent = lifespanOf(artist);
    this.#count.textContent = paintingCount(paintings);
    this.#fitName();
  }

  #stage(stage: Stage): void {
    if (stage === 'waiting') this.element.setAttribute('aria-busy', 'true');
    else this.element.removeAttribute('aria-busy');
    this.#barcode.element.hidden = stage === 'failed';
    this.#trouble.hidden = stage !== 'failed';
  }

  /** Sets the name as large as fits on one line, down to LEAST_NAME_SIZE, under which it wraps. */
  #fitName(): void {
    const name = this.#name;
    name.style.removeProperty('font-size');
    name.removeAttribute('data-wrap');
    const room = name.clientWidth;
    if (room === 0) return;
    // Type's width doesn't quite follow its size, so the size is fitted again until the name fits.
    let size = Number.parseFloat(getComputedStyle(name).fontSize);
    while (name.scrollWidth > room && size > LEAST_NAME_SIZE) {
      size = Math.max(LEAST_NAME_SIZE, Math.min(size - 1, Math.floor((size * room) / name.scrollWidth)));
      name.style.fontSize = `${size}px`;
    }
    name.toggleAttribute('data-wrap', name.scrollWidth > room);
  }
}
