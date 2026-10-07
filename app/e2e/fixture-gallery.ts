import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

// The Atlas's UI tests run on a gallery the pipeline builds from its fixture catalog (four
// paintings in color, in chunks of two), served in place of the site's own data, with the
// fixture's images served in place of Wikimedia Commons: the tests never depend on Commons, and
// they check the pipeline's output as the site reads it.

const FIXTURE_CATALOG = join(import.meta.dirname, '../../pipeline/fixtures/wikidata');
const PIPELINE = join(import.meta.dirname, '../../pipeline/build/src/paintings.ts');
/** Where the fixture gallery is built, outside the site's own data. */
export const FIXTURE_GALLERY = join(tmpdir(), 'palette-atlas-fixture-gallery');
/** Small enough that the fixture's paintings span two chunks. */
export const FIXTURE_CHUNK_SIZE = 2;

/** The fixture's paintings in gallery order, as the catalog describes them. */
export const FIXTURE_PAINTINGS = [
  { id: 'Q1747569', title: 'The Madonna in the Church', artist: 'Jan van Eyck' },
  { id: 'Q1217187', title: 'Calumny of Apelles', artist: 'Sandro Botticelli' },
  { id: 'Q17812507', title: 'View of the IJ from the East', artist: 'Hendrick Cornelisz Vroom' },
  { id: 'Q18748372', title: 'Female Saint Holding a Book', artist: 'Amico Aspertini' },
] as const;

/** The image file of a fixture painting, by its Wikidata item: the file the pipeline read its strips from. */
export function fixtureImage(id: string): string {
  return join(FIXTURE_CATALOG, 'images', `${id}.jpg`);
}

/** Playwright's global setup: builds the fixture gallery once, before every test. */
export default function buildFixtureGallery(): void {
  execFileSync(process.execPath, [PIPELINE, FIXTURE_CATALOG, FIXTURE_GALLERY, String(FIXTURE_CHUNK_SIZE)], { stdio: 'ignore' });
}

/** Serves the fixture gallery for the page's data, and the fixture's images for Commons. */
export async function serveFixtureGallery(page: Page): Promise<void> {
  await page.route('**/data/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ path: join(FIXTURE_GALLERY, path.slice(path.lastIndexOf('/data/') + '/data/'.length)) });
  });
  const images = commonsImages();
  await page.route(/^https:\/\/(thumb|upload)\.wikimedia\.org\//, (route) => {
    const image = images.get(commonsName(route.request().url()));
    return image ? route.fulfill({ path: image, contentType: 'image/jpeg' }) : route.fulfill({ status: 404 });
  });
}

/** The fixture's images by their names in Commons links. Every width of an image is served the same file. */
function commonsImages(): Map<string, string> {
  const { works } = JSON.parse(readFileSync(join(FIXTURE_CATALOG, 'works.json'), 'utf8')) as {
    works: { thumbnail: string; image: string }[];
  };
  return new Map(works.map(({ thumbnail, image }) => [commonsName(thumbnail), join(FIXTURE_CATALOG, image)]));
}

/** A file's escaped name in a link to it (…/commons/a/ab/<name>) or to its thumbnail (…/commons/thumb/a/ab/<name>/…). */
function commonsName(url: string): string {
  const path = new URL(url).pathname.split('/');
  return path[path.indexOf('commons') + (path.includes('thumb') ? 4 : 3)] ?? '';
}
