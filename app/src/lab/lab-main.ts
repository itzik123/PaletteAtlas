import '@fontsource-variable/bricolage-grotesque/standard.css';
import '../style.css';
import '../atlas/atlas.css';
import './lab.css';
import { ImageMatcher } from '../atlas/image-matcher.ts';
import { ImageQueries } from '../atlas/image-query.ts';
import { missingPage } from '../atlas/missing-page.ts';
import { SiteHeader } from '../site/site-header.ts';
import { Lab } from './lab.ts';
import { LabData } from './lab-data.ts';
import { imageLabQuery, type LabQuery, paintingLabQuery, REPLAY_PAGE } from './lab-query.ts';

/** The painting the Lab opens on, unless it is asked for another: The Starry Night. */
const FIRST_PAINTING = 'Q45585';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app element');
app.append(new SiteHeader('lab').element);
// Any image dropped on the Lab, pasted or chosen has its search replayed, on a page of its own.
const matcher = new ImageMatcher(app, REPLAY_PAGE);
const loading = document.createElement('p');
loading.className = 'lab-loading';
loading.textContent = 'Reading the index…';
app.append(loading);

LabData.load()
  .then(async (data) => {
    const query = await queryOf(data);
    const lab = new Lab(data, () => matcher.choose());
    loading.replaceWith(lab.element);
    await lab.search(query);
  })
  .catch(() => {
    document.querySelector('main.lab')?.remove();
    loading.remove();
    app.append(missingPage('The Lab didn’t load.'));
  });

/**
 * What the Lab replays the search for: a painting's colors (?like=<Wikidata item>), or an image's
 * (?match, see ImageQueries), or else The Starry Night's, or the gallery's first painting's if it
 * hasn't that.
 */
async function queryOf(data: LabData): Promise<LabQuery> {
  const params = new URLSearchParams(location.search);
  const like = params.get('like');
  const painting = like === null ? undefined : await data.gallery.find(like);
  if (painting) return paintingLabQuery(painting);
  const image = params.has('match') ? ImageQueries.take() : undefined;
  if (image) return imageLabQuery(image);
  // An address whose painting or image is gone opens on the first painting.
  if (location.search) history.replaceState(history.state, '', './lab.html');
  return paintingLabQuery((await data.gallery.find(FIRST_PAINTING)) ?? (await data.gallery.entry(0)));
}
