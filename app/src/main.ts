import '@fontsource-variable/bricolage-grotesque/standard.css';
import './style.css';
import { SOURCE_WIDTH } from '@palette-atlas/gallery';
import { GalleryData } from './atlas/gallery-data.ts';
import { titleOf } from './atlas/painting-text.ts';
import { SiteHeader } from './site/site-header.ts';
import { StripReader } from './studio/strip-reader.ts';
import { Studio } from './studio/studio.ts';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app element');

const studio = new Studio(new StripReader());
app.append(new SiteHeader('studio').element, studio.element);

// A painting opened from the Atlas (?painting=<Wikidata item>) comes in as if it had been dropped,
// read from the image the gallery read its strip from.
const paintingId = new URLSearchParams(location.search).get('painting');
if (paintingId) void openPainting(paintingId);

async function openPainting(id: string): Promise<void> {
  const entry = await GalleryData.load()
    .then((data) => data.find(id))
    .catch(() => undefined);
  await studio.open(entry ? `${titleOf(entry.painting)}.jpg` : id, async () => {
    if (!entry) throw new Error(`${id} is not in the Atlas`);
    const response = await fetch(entry.image.url(SOURCE_WIDTH));
    if (!response.ok) throw new Error(`${response.url}: ${response.status}`);
    return response.blob();
  });
}
