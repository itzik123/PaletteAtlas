import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { GALLERY_FILES, PaintingMap } from '@palette-atlas/gallery';
import { expect, type Page, test } from '@playwright/test';
import { byColorScheme } from './color-schemes.ts';
import { FIXTURE_GALLERY, FIXTURE_PAINTINGS, fixtureImage, serveFixtureGallery } from './fixture-gallery.ts';
import { storedStrip } from './stored-strips.ts';

/** Windows of laptops and desktops the Lab must fit without scrolling. */
const DESKTOP_WINDOWS = [
  { width: 1280, height: 720 },
  { width: 1440, height: 800 },
  { width: 1536, height: 730 },
  { width: 1920, height: 950 },
] as const;

test.beforeEach(({ page }) => serveFixtureGallery(page));

/** Takes the replay to its end at once, as dragging its scrubber to the end does. */
async function skipToEnd(page: Page): Promise<void> {
  await page.getByRole('slider', { name: 'Replay' }).press('End');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
}

/** The paintings the Lab shows as the nearest, by their positions in the fixture gallery. */
async function nearestShown(page: Page): Promise<number[]> {
  const ids = await page
    .locator('.nearest-tiles .painting-tile')
    .evaluateAll((tiles) => tiles.map((tile) => new URL((tile as HTMLAnchorElement).href).searchParams.get('id')));
  return ids.map((id) => FIXTURE_PAINTINGS.findIndex((painting) => painting.id === id));
}

/** The titles of the paintings on the Atlas's wall, in the order they hang. */
async function wallTitles(page: Page): Promise<string[]> {
  return page
    .locator('.wall .painting-tile')
    .evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('aria-label')?.split(', ')[0] ?? ''));
}

/** A painting's color on the Lab's map, as the pipeline wrote it. */
function mapColor(position: number): number[] {
  const map = PaintingMap.fromBytes(gunzipSync(readFileSync(join(FIXTURE_GALLERY, GALLERY_FILES.paintingMap))));
  return [...map.colors.subarray(position * 3, position * 3 + 3)];
}

/**
 * Where the layers show a color in a patch of 5 by 5 pixels of it alone, in CSS pixels from the
 * stack's corner: the middle of a painting's dot drawn large enough to point at.
 */
async function patchesOf(page: Page, color: readonly number[]): Promise<{ x: number; y: number }[]> {
  return page.locator('.stack-stage canvas').evaluate((canvas: HTMLCanvasElement, color) => {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not available');
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    const matches = (x: number, y: number): boolean => color.every((channel, at) => data[(y * width + x) * 4 + at] === channel);
    const found: { x: number; y: number }[] = [];
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        let all = true;
        for (let dy = -2; dy <= 2 && all; dy++) for (let dx = -2; dx <= 2 && all; dx++) all = matches(x + dx, y + dy);
        const css = { x: x / devicePixelRatio, y: y / devicePixelRatio };
        if (all && found.every((other) => Math.hypot(other.x - css.x, other.y - css.y) > 12)) found.push(css);
      }
    }
    return found;
  }, color);
}

test('replays the search for a painting’s colors layer by layer, to the paintings its Same colors wall hangs first', async ({ page }) => {
  await page.goto('/lab.html?like=Q1217187');
  await expect(page.getByRole('navigation', { name: 'Parts of the site' }).getByRole('link', { name: 'Lab' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  // The fixture's index has two layers: the landmarks on top, and every painting below.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Searched in two layers.');
  await expect(page.getByRole('link', { name: 'Calumny of Apelles', exact: true })).toHaveAttribute('href', './painting.html?id=Q1217187');
  // It plays as it opens.
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  await skipToEnd(page);
  const order = (await byColorScheme(page, await storedStrip(page, GALLERY_FILES.gallery, 1))).filter((position) => position !== 1);
  expect(await nearestShown(page)).toEqual(order);
  await expect(page.locator('.measured')).toHaveText(/^\s*4\s*of 4 measured\s*$/);
  await expect(page.getByText('The same 3 as measuring every painting.')).toBeVisible();

  await page.getByRole('link', { name: 'See the matches' }).click();
  await expect(page).toHaveURL(/\/atlas(\.html)?\?like=Q1217187$/);
  await expect(page.locator('.wall .painting-tile')).toHaveCount(order.length);
  expect(await wallTitles(page)).toEqual(order.map((position) => FIXTURE_PAINTINGS[position]?.title));
});

test('replays the search for an image chosen in the Lab, keeps it on coming back, and leads to its matches', async ({ page }) => {
  await page.goto('/lab.html');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New image' }).click();
  await (await chooser).setFiles(fixtureImage('Q18748372'));
  await expect(page).toHaveURL(/\/lab(\.html)?\?match$/);
  await expect(page.getByRole('img', { name: 'Your image' })).toBeVisible();

  await skipToEnd(page);
  // The browser reads the image's colors as the pipeline read the painting's from the same file.
  const order = await byColorScheme(page, await storedStrip(page, GALLERY_FILES.gallery, 3));
  expect(order[0]).toBe(3);
  expect(await nearestShown(page)).toEqual(order);

  await page.getByRole('link', { name: 'See the matches' }).click();
  await expect(page).toHaveURL(/\/atlas(\.html)?\?match$/);
  await expect(page.locator('.wall .painting-tile')).toHaveCount(order.length);
  expect(await wallTitles(page)).toEqual(order.map((position) => FIXTURE_PAINTINGS[position]?.title));

  await page.goBack();
  await expect(page.getByRole('img', { name: 'Your image' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('img', { name: 'Your image' })).toBeVisible();
  await skipToEnd(page);
  expect(await nearestShown(page)).toEqual(order);
});

test('opens on a painting of its own when asked for none, or for one not in the Atlas', async ({ page }) => {
  for (const path of ['/lab.html', '/lab.html?like=Q1']) {
    await page.goto(path);
    // The Starry Night opens the Lab; the fixture hasn't it, so its most famous painting does.
    await expect(page.getByRole('link', { name: FIXTURE_PAINTINGS[0].title, exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/lab(\.html)?$/);
  }
});

test('draws every painting in its own color, names it while pointed at, and opens its page on a click', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto('/lab.html?like=Q1217187');
  await skipToEnd(page);
  const { id, title } = FIXTURE_PAINTINGS[2];
  const stack = await page.locator('.stack-stage canvas').boundingBox();
  if (!stack) throw new Error('The stack is not laid out');
  // Its dot on the bottom layer, among the nearest, is large enough to show it whole; so is its
  // copy in the magnifier, which names nothing.
  const label = page.locator('.dot-label');
  let named = false;
  for (const { x, y } of await patchesOf(page, mapColor(2))) {
    await page.mouse.move(stack.x + x, stack.y + y);
    if (!(await label.isVisible())) continue;
    await expect(label).toContainText(title);
    named = true;
    await page.mouse.click(stack.x + x, stack.y + y);
    await expect(page).toHaveURL(new RegExp(`/painting(\\.html)?\\?id=${id}$`));
    break;
  }
  expect(named).toBe(true);
});

test('fits a desktop window without scrolling, its replay’s controls on the screen', async ({ page }) => {
  for (const size of DESKTOP_WINDOWS) {
    const where = `${size.width}×${size.height}`;
    await page.setViewportSize(size);
    await page.goto('/lab.html?like=Q1217187');
    await page.evaluate(() => document.fonts.ready);
    await skipToEnd(page);
    await expect(page.locator('.nearest-tiles .painting-tile')).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight), where).toBe(0);
    const play = await page.locator('.lab-transport').boundingBox();
    expect(play && play.y + play.height, where).toBeLessThanOrEqual(size.height);
  }
});
