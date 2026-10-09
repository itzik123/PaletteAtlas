import type { RgbaImage } from '@palette-atlas/color';
import type { GalleryEntry } from './gallery-data.ts';
import type { ImageQuery } from './image-query.ts';
import { titleOf } from './painting-text.ts';

/**
 * What the paintings nearest some colors are matched to, shown on a card over them (on the Atlas's
 * wall, and in the Lab): a painting of the gallery, or an image of the visitor's own.
 */
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

/** The largest a card shows its picture, in CSS pixels: its height, and the most it may be wide. */
export interface CardSize {
  readonly height: number;
  readonly maxWidth: number;
}

/** What the card of an image of the visitor's own says it shows. */
const YOUR_IMAGE = 'Your image';

/** The card of an image of the visitor's own. */
export function imageCard(image: ImageQuery): QueryCard {
  return { ...image, name: YOUR_IMAGE };
}

/** A painting's card: its picture from Commons, sharp at the card's size, leading to its page. */
export function paintingCard({ painting, image, strip }: GalleryEntry, size: CardSize): QueryCard {
  const aspect = painting.width / painting.height;
  const width = Math.min(size.height * aspect, size.maxWidth);
  return {
    picture: image.urlAtLeast(width * devicePixelRatio),
    aspect,
    colors: strip,
    name: titleOf(painting),
    href: `./painting.html?id=${painting.id}`,
  };
}

/** The card itself: its picture in its own shape, and a link to the painting's page, if it leads to one. */
export function queryCardElement(card: QueryCard): HTMLElement {
  const element = document.createElement(card.href ? 'a' : 'figure');
  element.className = 'query-card';
  element.style.setProperty('--aspect', String(card.aspect));
  const picture = document.createElement('img');
  picture.src = card.picture;
  if (element instanceof HTMLAnchorElement && card.href) {
    element.href = card.href;
    element.setAttribute('aria-label', card.name);
    picture.alt = '';
  } else {
    picture.alt = card.name;
  }
  element.append(picture);
  return element;
}
