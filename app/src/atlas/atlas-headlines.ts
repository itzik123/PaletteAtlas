import type { RgbaImage } from '@palette-atlas/color';
import { CLOSE_ICON, UPLOAD_ICON } from '../icons.ts';
import { imageCanvas } from '../image-adapters.ts';

// The headlines over the Atlas's wall (see Atlas): one over the whole gallery, and one over the
// paintings nearest an image's colors, or a painting's.

/** What the paintings nearest some colors are matched to, shown on a card beside their headline. */
export interface QueryCard {
  /** The picture's address. */
  readonly picture: string;
  /** The picture's width over its height. */
  readonly aspect: number;
  readonly colors: RgbaImage;
  /** What the picture shows, for those who can't see it. */
  readonly name: string;
  /** Where the card leads: a painting's own page. An image of the visitor's own leads nowhere. */
  readonly href?: string;
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
 * its color strip under the words "these colors.", which stand on it; then the way back to the
 * whole gallery.
 */
export function matchesHeadline(card: QueryCard): HTMLElement {
  const top = document.createElement('div');
  top.className = 'atlas-top matches-top';
  const shown = document.createElement(card.href ? 'a' : 'figure');
  shown.className = 'query-card';
  shown.style.setProperty('--aspect', String(card.aspect));
  const picture = document.createElement('img');
  picture.src = card.picture;
  if (shown instanceof HTMLAnchorElement && card.href) {
    shown.href = card.href;
    shown.setAttribute('aria-label', card.name);
    picture.alt = '';
  } else {
    picture.alt = card.name;
  }
  shown.append(picture);
  const text = document.createElement('div');
  text.className = 'matches-text';
  text.innerHTML = `
    <h1>Painted in <span class="named-colors">these colors.</span></h1>
    <a class="pill" href="./atlas.html">${CLOSE_ICON}<span>All paintings</span></a>
  `;
  const strip = imageCanvas(card.colors);
  strip.className = 'query-strip';
  // It repeats the colors of the picture the card names, so screen readers pass it by.
  strip.setAttribute('aria-hidden', 'true');
  text.querySelector('.named-colors')?.append(strip);
  top.append(shown, text);
  return top;
}
