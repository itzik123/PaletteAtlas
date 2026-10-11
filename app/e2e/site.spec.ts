import { expect, test } from '@playwright/test';
import { serveFixtureGallery } from './fixture-gallery.ts';

/** Each kind of page of the site, and what its "How it works" explains. */
const EXPLAINED = [
  { path: '/', title: 'How the Studio works' },
  { path: '/atlas.html', title: 'How the Atlas works' },
  { path: '/painting.html?id=Q1217187', title: 'How the strips work' },
  { path: '/artist.html?id=Q5669', title: 'How Career Barcodes work' },
  { path: '/lab.html', title: 'How the Lab works' },
] as const;

/**
 * A laptop's screen, and how far down it the Atlas's wall may begin: within its upper half, under
 * the headline and the way to match an image.
 */
const LAPTOP = { width: 1280, height: 720 } as const;
const WALL_BEGINS_WITHIN = 0.45;
const PHONE = { width: 390, height: 800 } as const;
/** Phones' screens, from the narrowest still in use to the widest, in CSS pixels. */
const NARROWEST_PHONE = 320;
const WIDEST_PHONE = 430;
/** Where the site is served for good: a link preview names its picture by its full address there. */
const SITE_URL = 'https://itzik123.github.io/PaletteAtlas/';
/** The size of a link preview's picture, the size chats and feeds draw a link's card at. */
const PREVIEW_PICTURE = { width: 1200, height: 630 } as const;

test.beforeEach(({ page }) => serveFixtureGallery(page));

test('explains each part of the site in its own words', async ({ page }) => {
  for (const { path, title } of EXPLAINED) {
    await page.goto(path);
    await page.getByRole('button', { name: 'How it works' }).click();
    const explanation = page.getByRole('dialog', { name: title });
    await expect(explanation).toBeVisible();
    await explanation.getByRole('button', { name: 'Close' }).click();
    await expect(explanation).toBeHidden();
  }
});

test('gives each page a link preview, as chats and feeds read it without running scripts: its title, its words and a picture of it', async ({
  browser,
  baseURL,
  page,
}) => {
  const crawler = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const card = await crawler.newPage();
  const tag = (key: string) => card.locator(`meta[property="${key}"], meta[name="${key}"]`);
  for (const { path } of EXPLAINED) {
    await card.goto(path);
    await expect(tag('og:title'), path).toHaveAttribute('content', await card.title());
    await expect(tag('og:description'), path).toHaveAttribute('content', (await tag('description').getAttribute('content')) ?? '');
    await expect(tag('twitter:card'), path).toHaveAttribute('content', 'summary_large_image');
    await expect(tag('og:image:width'), path).toHaveAttribute('content', String(PREVIEW_PICTURE.width));
    await expect(tag('og:image:height'), path).toHaveAttribute('content', String(PREVIEW_PICTURE.height));

    await expect(tag('og:image'), path).toHaveCount(1);
    const picture = (await tag('og:image').getAttribute('content')) ?? '';
    expect(picture.startsWith(SITE_URL), `${path}: ${picture}`).toBe(true);
    const served = await page.goto(`/${picture.slice(SITE_URL.length)}`);
    expect(served?.headers()['content-type'], picture).toBe('image/jpeg');
    const size = await page.locator('img').evaluate((image: HTMLImageElement) => ({ width: image.naturalWidth, height: image.naturalHeight }));
    expect(size, picture).toEqual(PREVIEW_PICTURE);
  }
  await crawler.close();
});

test('leads from the name at the top to the home of the part of the site it is on', async ({ page }) => {
  await page.goto('/artist.html?id=Q5669');
  await page.getByRole('banner').getByRole('link', { name: 'Palette Atlas', exact: true }).click();
  await expect(page).toHaveURL(/\/atlas(\.html)?$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^4 paintings/);

  await page.goto('/lab.html?like=Q1217187');
  await page.getByRole('banner').getByRole('link', { name: 'Palette Atlas', exact: true }).click();
  await expect(page).toHaveURL(/\/lab(\.html)?$/);
});

test('keeps the way to the Career Barcodes at the top: by name on a laptop, its icon beside How it works on a phone', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.goto('/atlas.html');
  const atTop = page.getByRole('banner').getByRole('link', { name: 'Career Barcodes' });
  await expect(atTop).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'Career Barcodes' })).toHaveCount(0);
  const wall = page.locator('.wall');
  expect((await wall.boundingBox())?.y).toBeLessThan(LAPTOP.height * WALL_BEGINS_WITHIN);
  const named = await atTop.boundingBox();
  expect(named && named.width / named.height).toBeGreaterThan(2);

  // On a phone, the paintings begin within the first screen's upper half, under the headline and
  // the way to match an image alone.
  await page.setViewportSize(PHONE);
  await expect(atTop).toBeVisible();
  const [icon, explain] = await Promise.all([atTop.boundingBox(), page.getByRole('button', { name: 'How it works' }).boundingBox()]);
  if (!icon || !explain) throw new Error('The header’s buttons are not laid out');
  expect(Math.abs(icon.width - icon.height)).toBeLessThan(1);
  expect(explain.x - (icon.x + icon.width)).toBeGreaterThan(0);
  expect(explain.x - (icon.x + icon.width)).toBeLessThan(16);
  expect(Math.abs(icon.y - explain.y)).toBeLessThan(1);
  expect((await wall.boundingBox())?.y).toBeLessThan(PHONE.height / 2);

  // On the Career Barcodes themselves, it stands for the page shown.
  await page.setViewportSize(LAPTOP);
  await atTop.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jan van Eyck');
  await expect(atTop).toHaveAttribute('aria-current', 'page');
});

for (const { path } of EXPLAINED) {
  test(`fits the header’s name, its buttons and the switch between the parts within phones down to the narrowest, so ${path} never pans sideways`, async ({
    page,
  }) => {
    for (let width = NARROWEST_PHONE; width <= WIDEST_PHONE; width += 10) {
      await page.setViewportSize({ width, height: PHONE.height });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      // How far the buttons reach past the header's padding on the right.
      const past = await page.getByRole('banner').evaluate((header) => {
        const items = [...header.querySelectorAll('.brand, .site-actions > *, .careers-link, .part-switch')];
        const inside = header.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(header).paddingRight);
        return Math.max(...items.map((item) => item.getBoundingClientRect().right)) - inside;
      });
      expect(past, `${width} px`).toBeLessThanOrEqual(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${width} px`).toBe(width);
    }
  });
}

test('leaves the way to every Career Barcode off a painting’s page, which leads to its artist’s own', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.goto('/painting.html?id=Q1217187');
  await expect(page.getByRole('link', { name: 'Career Barcode', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Career Barcodes' })).toHaveCount(0);
});

test('floats Studio | Atlas | Lab at the foot of a phone held upright, and keeps it in the header on a phone on its side', async ({ page }) => {
  const parts = page.getByRole('navigation', { name: 'Parts of the site' });
  for (const [size, floats] of [
    [PHONE, true],
    [{ width: 667, height: 375 }, false],
    [{ width: 844, height: 390 }, false],
  ] as const) {
    await page.setViewportSize(size);
    for (const path of ['/atlas.html', '/lab.html']) {
      await page.goto(path);
      const where = `${size.width}×${size.height} ${path}`;
      expect(await parts.evaluate((nav) => getComputedStyle(nav).position), where).toBe(floats ? 'fixed' : 'static');
      // On its side, it fits the header with the buttons beside it, within the screen.
      if (!floats) {
        const [switchBox, header] = await Promise.all([parts.boundingBox(), page.getByRole('banner').boundingBox()]);
        expect(switchBox && header && switchBox.y + switchBox.height <= header.y + header.height, where).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), where).toBe(0);
        await expect(page.getByRole('banner').getByRole('link', { name: 'GitHub' }), where).toBeInViewport({ ratio: 1 });
      }
    }
  }
});
