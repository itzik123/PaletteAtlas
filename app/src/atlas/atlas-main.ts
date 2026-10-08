import '@fontsource-variable/bricolage-grotesque/standard.css';
import '../style.css';
import './atlas.css';
import { SiteHeader } from '../site/site-header.ts';
import { Atlas } from './atlas.ts';
import { galleryHeadline, matchesHeadline, type QueryCard } from './atlas-headlines.ts';
import { ColorMatches } from './color-matches.ts';
import { GalleryData, type GalleryEntry } from './gallery-data.ts';
import { ImageMatcher } from './image-matcher.ts';
import { ImageQueries } from './image-query.ts';
import { missingPage } from './missing-page.ts';
import { titleOf } from './painting-text.ts';
import { GALLERY_ROWS, MATCH_ROWS } from './wall.ts';
import { WallPlaces } from './wall-place.ts';

/** How many of the paintings nearest some colors the wall hangs at most, the nearest first: well past where they stop resembling them. */
const MATCHES = 600;
/** The picture on the query's card at its largest, in CSS pixels (see .query-card in atlas.css). */
const CARD_PICTURE = { height: 210, maxWidth: 440 } as const;
/** What the card of an image of the visitor's own shows, for those who can't see it. */
const YOUR_IMAGE = 'Your image';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app element');
app.append(new SiteHeader('atlas').element);
// Any image dropped on the Atlas, pasted or chosen is matched to its paintings.
const matcher = new ImageMatcher(app);

// The wall fills in as its paintings arrive, after the browser would scroll back to where the
// visitor was; the Atlas scrolls there itself once they're hung.
history.scrollRestoration = 'manual';
GalleryData.load()
  .then(atlasOf)
  .then(
    (atlas) => app.append(atlas.element),
    () => app.append(missingPage('The Atlas didn’t load.')),
  );

/**
 * The Atlas this page shows: the paintings nearest a painting's colors (?like=<Wikidata item>), or
 * an image's (?match, see ImageQueries), or else the whole gallery.
 */
async function atlasOf(data: GalleryData): Promise<Atlas> {
  const params = new URLSearchParams(location.search);
  const like = params.get('like');
  const painting = like === null ? undefined : await data.find(like);
  const image = params.has('match') ? ImageQueries.take() : undefined;
  const matches = new ColorMatches(data);
  if (painting) {
    const headline = matchesHeadline(paintingCard(painting));
    return new Atlas(matches.of(painting.strip, MATCHES, painting.position), headline, MATCH_ROWS, WallPlaces.saved());
  }
  if (image) {
    const headline = matchesHeadline({ ...image, name: YOUR_IMAGE });
    return new Atlas(matches.of(image.colors, MATCHES), headline, MATCH_ROWS, WallPlaces.saved());
  }
  // An address whose painting or image is gone opens the whole gallery.
  if (location.search) history.replaceState(history.state, '', './atlas.html');
  return new Atlas(data, galleryHeadline(data.count, () => matcher.choose()), GALLERY_ROWS, WallPlaces.saved());
}

/** A painting's card over its matches: its picture from Commons, sharp at the card's size, leading to its page. */
function paintingCard({ painting, image, strip }: GalleryEntry): QueryCard {
  const aspect = painting.width / painting.height;
  const width = Math.min(CARD_PICTURE.height * aspect, CARD_PICTURE.maxWidth);
  return {
    picture: image.urlAtLeast(width * devicePixelRatio),
    aspect,
    colors: strip,
    name: titleOf(painting),
    href: `./painting.html?id=${painting.id}`,
  };
}
