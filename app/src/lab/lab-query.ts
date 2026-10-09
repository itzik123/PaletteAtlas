import type { RgbaImage } from '@palette-atlas/color';
import type { GalleryEntry } from '../atlas/gallery-data.ts';
import { type ImageQuery, ImageQueries, MATCHES_PAGE } from '../atlas/image-query.ts';
import { titleOf } from '../atlas/painting-text.ts';

/** The Lab's page that replays the search for the image handed to it (see ImageQueries). */
export const REPLAY_PAGE = './lab.html?match';

/** The picture on the query's card at its largest, in CSS pixels (see .lab-query in lab.css). */
const CARD_PICTURE = { height: 108, maxWidth: 150 } as const;

/** What the Lab replays the search for, and where its matches hang on the Atlas. */
export interface LabQuery {
  /** The picture's address. */
  readonly picture: string;
  /** The picture's width over its height. */
  readonly aspect: number;
  readonly colors: RgbaImage;
  /** What the picture shows, for those who can't see it. */
  readonly name: string;
  /** Where its card leads: a painting's own page. An image of the visitor's own leads nowhere. */
  readonly href?: string;
  /** A painting searched by its own colors, by its position, which its nearest leave out. */
  readonly leaveOut?: number;
  /** The Atlas's page of its matches. */
  readonly matches: string;
  /** Readies that page before it opens: hands it an image of the visitor's own. */
  readonly beforeMatches?: () => void;
}

/** An image of the visitor's own, handed to the Lab (see ImageQueries). */
export function imageLabQuery(image: ImageQuery): LabQuery {
  return { ...image, name: 'Your image', matches: MATCHES_PAGE, beforeMatches: () => ImageQueries.hand(image) };
}

/** A painting of the gallery, searched by its own colors as its Same colors are. */
export function paintingLabQuery({ painting, image, strip, position }: GalleryEntry): LabQuery {
  const aspect = painting.width / painting.height;
  const width = Math.min(CARD_PICTURE.height * aspect, CARD_PICTURE.maxWidth);
  return {
    picture: image.urlAtLeast(width * devicePixelRatio),
    aspect,
    colors: strip,
    name: titleOf(painting),
    href: `./painting.html?id=${painting.id}`,
    leaveOut: position,
    matches: `./atlas.html?like=${painting.id}`,
  };
}
