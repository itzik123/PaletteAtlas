import { GALLERY_FILES, THUMBNAIL_WIDTHS } from '@palette-atlas/gallery';
import { expect, test } from '@playwright/test';
import { FIXTURE_PAINTINGS, serveFixtureGallery } from './fixture-gallery.ts';
import { canvasColors, storedStrip } from './stored-strips.ts';

/** The axes' strips on a painting's page, by their accessible names. */
const AXIS_STRIPS = ['Color strip', 'Hilbert strip', 'Columns strip', 'Radial strip'];

test.beforeEach(({ page }) => serveFixtureGallery(page));

test('hangs the paintings on the wall in gallery order, each over the color strip the pipeline stored', async ({ page }) => {
  await page.goto('/atlas.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^4 paintings/);
  await expect(page.getByRole('navigation', { name: 'Parts of the site' }).getByRole('link', { name: 'Atlas' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const tiles = page.locator('.painting-tile');
  await expect(tiles).toHaveCount(FIXTURE_PAINTINGS.length);
  for (const [position, { title, artist }] of FIXTURE_PAINTINGS.entries()) {
    const tile = tiles.nth(position);
    await expect(tile).toHaveAccessibleName(new RegExp(`^${title}, ${artist}, `));
    // Pictures come from Commons, at one of the widths it serves.
    const src = await tile.locator('img').getAttribute('src');
    expect(src).toMatch(/^https:\/\/thumb\.wikimedia\.org\//);
    expect(THUMBNAIL_WIDTHS).toContain(Number(/\/(\d+)px-[^/]*$/.exec(src ?? '')?.[1]));
    expect(await canvasColors(tile.locator('canvas')), title).toEqual(await storedStrip(page, GALLERY_FILES.gallery, position));
  }
});

test('fills each full row of the wall to its width, its paintings all as tall', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/atlas.html');
  const tiles = page.locator('.painting-tile');
  await expect(tiles).toHaveCount(FIXTURE_PAINTINGS.length);
  const wall = await page.locator('.wall').boundingBox();
  const [madonna, calumny, view, saint] = await Promise.all(FIXTURE_PAINTINGS.map((_, index) => tiles.nth(index).boundingBox()));
  if (!wall || !madonna || !calumny || !view || !saint) throw new Error('The wall is not laid out');
  // The first three fill a row; the fourth starts the next.
  for (const tile of [calumny, view]) {
    expect(tile.y).toBeCloseTo(madonna.y, 0);
    expect(tile.height).toBeCloseTo(madonna.height, 0);
  }
  expect(madonna.x).toBeCloseTo(wall.x, 0);
  expect(view.x + view.width).toBeGreaterThan(wall.x + wall.width - 2);
  expect(view.x + view.width).toBeLessThanOrEqual(wall.x + wall.width);
  expect(saint.y).toBeGreaterThan(madonna.y + madonna.height);
});

test('opens a painting’s page: its details, its credit, and its strips read in the browser from its image on Commons', async ({
  page,
}) => {
  await page.goto('/atlas.html');
  await page.locator('.painting-tile').nth(1).click();
  await expect(page).toHaveURL(/\/painting(\.html)?\?id=Q1217187$/);
  await expect(page).toHaveTitle('Calumny of Apelles · Palette Atlas');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Calumny of Apelles');
  await expect(page.locator('.painting-artist')).toHaveText('Sandro Botticelli (1445–1510)');
  // 1497, known to the decade.
  await expect(page.locator('.painting-date')).toHaveText('1490s');
  await expect(page.locator('.painting-collection')).toHaveText('Uffizi Gallery');
  await expect(page.getByRole('link', { name: 'Commons' })).toHaveAttribute(
    'href',
    'https://commons.wikimedia.org/wiki/File:Sandro_Botticelli_La_calumnia_de_Apeles.jpg',
  );
  await expect(page.getByRole('link', { name: 'Wikidata' })).toHaveAttribute('href', 'https://www.wikidata.org/wiki/Q1217187');
  // Only the browser's reading draws the other axes; with it, the color strip is the browser's too.
  for (const name of AXIS_STRIPS) await expect(page.getByRole('img', { name })).toBeVisible();
  expect(await canvasColors(page.getByRole('img', { name: 'Color strip' }))).toEqual(await storedStrip(page, GALLERY_FILES.gallery, 1));
});

test('opens a painting in the Studio from its page, read from the same image', async ({ page }) => {
  await page.goto('/painting.html?id=Q1217187');
  await page.getByRole('link', { name: 'Open in Studio' }).click();
  await expect(page).toHaveURL(/\/\?painting=Q1217187$/);
  await expect(page.locator('.studio')).toHaveAttribute('data-state', 'loaded');
  await expect(page.getByRole('img', { name: 'Calumny of Apelles' })).toBeVisible();
  expect(await canvasColors(page.getByRole('img', { name: 'Strip' }))).toEqual(await storedStrip(page, GALLERY_FILES.gallery, 1));
});

test('says so when a painting isn’t in the Atlas, and leads back to it', async ({ page }) => {
  await page.goto('/painting.html?id=Q1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This painting isn’t in the Atlas.');
  await page.getByRole('main').getByRole('link', { name: 'Atlas' }).click();
  await expect(page.locator('.painting-tile')).toHaveCount(FIXTURE_PAINTINGS.length);
});

test('comes back to the same place on the wall from a painting, by its back link or the browser’s', async ({ page }) => {
  // Short enough that the wall scrolls.
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.goto('/atlas.html');
  const tiles = page.locator('.painting-tile');
  await expect(tiles).toHaveCount(FIXTURE_PAINTINGS.length);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const place = await page.evaluate(() => window.scrollY);
  expect(place).toBeGreaterThan(0);

  await tiles.last().click();
  await page.getByRole('main').getByRole('link', { name: 'Atlas' }).click();
  await expect(tiles).toHaveCount(FIXTURE_PAINTINGS.length);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(place);

  await tiles.last().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Female Saint Holding a Book');
  await page.goBack();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(place);
});

test('shows all of a painting’s page on a laptop’s screen, without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/painting.html?id=Q1217187');
  for (const name of AXIS_STRIPS) await expect(page.getByRole('img', { name })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('link', { name: 'Open in Studio' })).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.painting-collection')).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(720);
});

test('gives a wide painting the page’s width, its details under it', async ({ page }) => {
  // Vroom's View of the IJ is 2.76 times as wide as it is tall.
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/painting.html?id=Q17812507');
  const card = await page.locator('.painting-frame').boundingBox();
  const picture = await page.getByRole('img', { name: 'View of the IJ from the East' }).boundingBox();
  const title = await page.getByRole('heading', { level: 1 }).boundingBox();
  if (!card || !picture || !title) throw new Error('The page is not laid out');
  // The card spans the page's 1,176 px; beside the details, the whole card would get about 660.
  expect(card.width).toBeGreaterThan(1150);
  expect(picture.width).toBeGreaterThan(900);
  expect(title.y).toBeGreaterThan(picture.y + picture.height);
  for (const name of AXIS_STRIPS) await expect(page.getByRole('img', { name })).toBeInViewport({ ratio: 1 });
});

test('pans a painting too wide to see at the screen’s width, by dragging it sideways', async ({ page }) => {
  // At this width, Vroom's View of the IJ would be too short to see whole.
  await page.setViewportSize({ width: 360, height: 700 });
  await page.goto('/painting.html?id=Q17812507');
  const view = page.locator('.painting-view');
  await expect(view).toHaveAttribute('data-pan');
  const { scrollWidth, clientWidth } = await view.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(scrollWidth).toBeGreaterThan(clientWidth);
  const box = await view.boundingBox();
  if (!box) throw new Error('The picture is not laid out');
  await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  expect(await view.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
});

test('enlarges a painting over its page on a click, and puts it away on another, or on Escape', async ({ page }) => {
  await page.goto('/painting.html?id=Q1217187');
  const picture = page.getByRole('img', { name: 'Calumny of Apelles' });
  const enlarged = page.getByRole('dialog', { name: 'Calumny of Apelles' });
  await picture.click();
  await expect(enlarged).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(enlarged).toBeHidden();
  await picture.click();
  await expect(enlarged).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(enlarged).toBeHidden();
});
