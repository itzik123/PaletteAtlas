import '@fontsource-variable/bricolage-grotesque/standard.css';
import '../style.css';
import './atlas.css';
import { SiteHeader } from '../site/site-header.ts';
import { ArtistPage } from './artist-page.ts';
import { GalleryData } from './gallery-data.ts';
import { missingPage } from './missing-page.ts';
import { nameOf } from './painting-text.ts';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app element');
app.append(new SiteHeader('atlas').element);

// The artist is named by their Wikidata item: artist.html?id=Q5582.
const id = new URLSearchParams(location.search).get('id');
GalleryData.load()
  .then((data) => (id ? data.career(id) : undefined))
  .then(
    (career) => {
      if (!career) {
        app.append(missingPage('This artist isn’t in the Atlas.'));
      } else if (career.paintings.length === 0) {
        app.append(missingPage('None of this artist’s paintings has a date to place.'));
      } else {
        document.title = `${nameOf(career.artist)} · Palette Atlas`;
        app.append(new ArtistPage(career).element);
      }
    },
    () => app.append(missingPage('This artist didn’t load.')),
  );
