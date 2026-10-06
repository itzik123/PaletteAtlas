import '@fontsource-variable/bricolage-grotesque/standard.css';
import '../style.css';
import './atlas.css';
import { SiteHeader } from '../site/site-header.ts';
import { StripReader } from '../studio/strip-reader.ts';
import { GalleryData } from './gallery-data.ts';
import { missingPage } from './missing-page.ts';
import { PaintingPage } from './painting-page.ts';
import { titleOf } from './painting-text.ts';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app element');
app.append(new SiteHeader('painting').element);

// The painting is named by its Wikidata item: painting.html?id=Q12418.
const id = new URLSearchParams(location.search).get('id');
GalleryData.load()
  .then((data) =>
    Promise.all([
      id ? data.find(id) : undefined,
      // Without them, the page shows no way to the artist's Career Barcode.
      data.careerLengths().catch((): readonly number[] => []),
    ]),
  )
  .then(
    ([entry, careerLengths]) => {
      if (!entry) {
        app.append(missingPage('This painting isn’t in the Atlas.'));
        return;
      }
      document.title = `${titleOf(entry.painting)} · Palette Atlas`;
      const hasCareer = (careerLengths[entry.painting.artist] ?? 0) > 0;
      app.append(new PaintingPage(entry, new StripReader(), hasCareer).element);
    },
    () => app.append(missingPage('This painting didn’t load.')),
  );
