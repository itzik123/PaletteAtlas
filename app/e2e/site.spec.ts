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
