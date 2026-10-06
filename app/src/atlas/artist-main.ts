import '@fontsource-variable/bricolage-grotesque/standard.css';
import '../style.css';
import './atlas.css';
import { SiteHeader } from '../site/site-header.ts';
import { ArtistPage } from './artist-page.ts';
import { GalleryData } from './gallery-data.ts';
import { missingPage } from './missing-page.ts';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app element');
app.append(new SiteHeader('atlas').element);

// The artist is named by their Wikidata item, artist.html?id=Q5582; with none named, the page
// opens at the most famous.
const id = new URLSearchParams(location.search).get('id');
GalleryData.load()
  .then((data) => page(data, id))
  .then(
    (element) => app.append(element),
    () => app.append(missingPage('This artist didn’t load.')),
  );

async function page(data: GalleryData, id: string | null): Promise<HTMLElement> {
  const painters = await data.painters();
  const shown = id === null ? painters[0] : painters.find(({ artist }) => artist.id === id);
  const career = shown && (await data.career(shown.artist.id));
  if (shown && career) return new ArtistPage(data, painters, shown, career).element;
  // Not among the painters: not in the Atlas at all, or with no painting dated closely enough to place.
  const known = id !== null && (await data.career(id)) !== undefined;
  return missingPage(known ? 'None of this artist’s paintings has a date to place.' : 'This artist isn’t in the Atlas.');
}
