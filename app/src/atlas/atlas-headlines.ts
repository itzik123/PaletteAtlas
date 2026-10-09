import { CLOSE_ICON, LAB_ICON, UPLOAD_ICON } from '../icons.ts';
import { imageCanvas } from '../image-adapters.ts';
import { type QueryCard, queryCardElement } from './query-card.ts';

// The headlines over the Atlas's wall (see Atlas): one over the whole gallery, and one over the
// paintings nearest an image's colors, or a painting's.

/** The way from the paintings nearest some colors to the Lab, which replays the search that found them. */
export interface LabDoor {
  /** The Lab's page for the same colors. */
  readonly href: string;
  /** Readies that page before it opens: hands it an image of the visitor's own (see ImageQueries). */
  readonly onOpen?: () => void;
}

/**
 * The headline over the whole gallery: its count on a yellow card, then the way to match an image
 * and a word on what that does.
 */
export function galleryHeadline(count: number, onMatch: () => void): HTMLElement {
  const top = document.createElement('div');
  top.className = 'atlas-top';
  const headline = document.createElement('h1');
  const total = document.createElement('span');
  total.className = 'count';
  total.textContent = count.toLocaleString('en');
  headline.append(total, ' paintings, strip by strip.');
  const match = document.createElement('div');
  match.className = 'match-row';
  match.innerHTML = `
    <button class="pill match-button" type="button">${UPLOAD_ICON}<span>Match an image</span></button>
    <p class="match-hint">
      <span class="pointer-only">Drop in any image to find paintings in its colors.</span>
      <span class="touch-only">Pick any image to find paintings in its colors.</span>
    </p>
  `;
  match.querySelector('button')?.addEventListener('click', onMatch);
  top.append(headline, match);
  return top;
}

/**
 * The headline over the paintings nearest some colors: what they were matched to on a card, and
 * its color strip under the words "these colors.", which stand on it; then the way to the Lab's
 * replay of the search that found them, and the way back to the whole gallery.
 */
export function matchesHeadline(card: QueryCard, lab: LabDoor): HTMLElement {
  const top = document.createElement('div');
  top.className = 'atlas-top matches-top';
  const text = document.createElement('div');
  text.className = 'matches-text';
  text.innerHTML = `
    <h1>Painted in <span class="named-colors">these colors.</span></h1>
    <div class="matches-ways">
      <a class="pill lab-door">${LAB_ICON}<span>How they were found</span></a>
      <a class="pill all-paintings" href="./atlas.html">${CLOSE_ICON}<span>All paintings</span></a>
    </div>
  `;
  const door = text.querySelector('.lab-door') as HTMLAnchorElement;
  door.href = lab.href;
  door.addEventListener('click', () => lab.onOpen?.());
  const strip = imageCanvas(card.colors);
  strip.className = 'query-strip';
  // It repeats the colors of the picture the card names, so screen readers pass it by.
  strip.setAttribute('aria-hidden', 'true');
  text.querySelector('.named-colors')?.append(strip);
  top.append(queryCardElement(card), text);
  return top;
}
