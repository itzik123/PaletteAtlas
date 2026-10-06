import '@fontsource-variable/bricolage-grotesque/standard.css';
import '../style.css';
import './atlas.css';
import { SiteHeader } from '../site/site-header.ts';
import { Atlas } from './atlas.ts';
import { GalleryData } from './gallery-data.ts';
import { missingPage } from './missing-page.ts';
import { WallPlaces } from './wall-place.ts';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app element');
app.append(new SiteHeader('atlas').element);

// The wall fills in as its paintings arrive, after the browser would scroll back to where the
// visitor was; the Atlas scrolls there itself once they're hung.
history.scrollRestoration = 'manual';
GalleryData.load().then(
  (data) => app.append(new Atlas(data, WallPlaces.saved()).element),
  () => app.append(missingPage('The Atlas didn’t load.')),
);
