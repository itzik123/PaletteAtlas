import type { GalleryEntry } from '../atlas/gallery-data.ts';
import { type ImageQuery, ImageQueries, MATCHES_PAGE } from '../atlas/image-query.ts';
import { type CardSize, imageCard, paintingCard, type QueryCard } from '../atlas/query-card.ts';

/** The Lab's page that replays the search for the image handed to it (see ImageQueries). */
export const REPLAY_PAGE = './lab.html?match';

/** The picture on the query's card at its largest, in CSS pixels (see .lab-query in lab.css). */
const CARD_PICTURE: CardSize = { height: 108, maxWidth: 150 };

/** What the Lab replays the search for, on its card, and where its matches hang on the Atlas. */
export interface LabQuery extends QueryCard {
  /** A painting searched by its own colors, by its position, which its nearest leave out. */
  readonly leaveOut?: number;
  /** The Atlas's page of its matches. */
  readonly matches: string;
  /** Readies that page before it opens: hands it an image of the visitor's own. */
  readonly beforeMatches?: () => void;
}

/** An image of the visitor's own, handed to the Lab (see ImageQueries). */
export function imageLabQuery(image: ImageQuery): LabQuery {
  return { ...imageCard(image), matches: MATCHES_PAGE, beforeMatches: () => ImageQueries.hand(image) };
}

/** A painting of the gallery, searched by its own colors as its Same colors are. */
export function paintingLabQuery(entry: GalleryEntry): LabQuery {
  return { ...paintingCard(entry, CARD_PICTURE), leaveOut: entry.position, matches: `./atlas.html?like=${entry.painting.id}` };
}
