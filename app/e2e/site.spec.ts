import { expect, test } from '@playwright/test';
import { serveFixtureGallery } from './fixture-gallery.ts';

/** Each kind of page of the site, and what its "How it works" explains. */
const EXPLAINED = [
  { path: '/', title: 'How the Studio works' },
  { path: '/atlas.html', title: 'How the Atlas works' },
  { path: '/painting.html?id=Q1217187', title: 'How the strips work' },
  { path: '/artist.html?id=Q5669', title: 'How Career Barcodes work' },
] as const;

/** A laptop's screen, and how far down it the Atlas's wall may begin: well within its upper half. */
const LAPTOP = { width: 1280, height: 720 } as const;
const WALL_BEGINS_WITHIN = 0.4;
const PHONE = { width: 390, height: 800 } as const;

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
});

test('keeps the way to the Career Barcodes at the top on a laptop, under the headline on a phone', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.goto('/atlas.html');
  const atTop = page.getByRole('banner').getByRole('link', { name: 'Career Barcodes' });
  const underHeadline = page.getByRole('main').getByRole('link', { name: 'Career Barcodes' });
  await expect(atTop).toBeVisible();
  await expect(underHeadline).toBeHidden();
  const wall = await page.locator('.wall').boundingBox();
  expect(wall?.y).toBeLessThan(LAPTOP.height * WALL_BEGINS_WITHIN);

  await page.setViewportSize(PHONE);
  await expect(atTop).toBeHidden();
  await expect(underHeadline).toBeVisible();

  // On the Career Barcodes themselves, it stands for the page shown.
  await page.setViewportSize(LAPTOP);
  await atTop.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jan van Eyck');
  await expect(atTop).toHaveAttribute('aria-current', 'page');
});

test('leaves the way to every Career Barcode off a painting’s page, which leads to its artist’s own', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.goto('/painting.html?id=Q1217187');
  await expect(page.getByRole('link', { name: 'Career Barcode', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Career Barcodes' })).toHaveCount(0);
});
