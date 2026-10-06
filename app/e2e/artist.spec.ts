import { BYTES_PER_PIXEL, LinearRgb, MAX_BYTE } from '@palette-atlas/color';
import { GALLERY_FILES } from '@palette-atlas/gallery';
import { expect, type Locator, test } from '@playwright/test';
import { serveFixtureGallery } from './fixture-gallery.ts';
import { storedStrip } from './stored-strips.ts';

/**
 * Botticelli, whose Calumny of Apelles (1497, known to the decade) is his one painting in the
 * fixture gallery: his career comes second in it, after van Eyck's, its first artist.
 */
const BOTTICELLI = { id: 'Q5669', name: 'Sandro Botticelli', career: 1, painting: 'Q1217187' } as const;

test.beforeEach(({ page }) => serveFixtureGallery(page));

/** A canvas's colors at the top and the bottom of its middle column, four bytes each. */
function columnEnds(canvas: Locator): Promise<{ top: number[]; bottom: number[] }> {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not available');
    const pixel = (y: number): number[] => Array.from(context.getImageData(Math.floor(element.width / 2), y, 1, 1).data);
    return { top: pixel(0), bottom: pixel(element.height - 1) };
  });
}

test('leads from a painting’s page to its artist’s Career Barcode, by the barcode beside their name', async ({ page }) => {
  await page.goto(`/painting.html?id=${BOTTICELLI.painting}`);
  const link = page.getByRole('link', { name: 'Career Barcode' });
  await link.hover();
  await expect(page.locator('.career-link .tooltip')).toHaveCSS('opacity', '1');
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/artist(\\.html)?\\?id=${BOTTICELLI.id}$`));
  await expect(page).toHaveTitle(`${BOTTICELLI.name} · Palette Atlas`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(BOTTICELLI.name);
  await expect(page.locator('.artist-facts')).toHaveText('1445–1510 1 painting');
});

test('shows no way to a Career Barcode for an artist without a painting dated closely enough to place', async ({ page }) => {
  await page.route('**/data/careers.json', (route) => route.fulfill({ json: [0, 0, 0, 0] }));
  await page.goto(`/painting.html?id=${BOTTICELLI.painting}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Calumny of Apelles');
  await expect(page.getByRole('link', { name: 'Career Barcode' })).toHaveCount(0);
});

test('draws every painting of a career as a bar of its color strip, the darker end at the bottom, or of its average color', async ({
  page,
}) => {
  await page.goto(`/artist.html?id=${BOTTICELLI.id}`);
  const barcode = page.getByRole('img', { name: 'Career Barcode: 1 painting, 1495' });
  await expect(barcode).toBeVisible();
  // The strip is the one the pipeline stored for his career; his one painting's bar spans the barcode.
  const strip = await storedStrip(page, GALLERY_FILES.careers, BOTTICELLI.career);
  const segment = (index: number): number[] => strip.slice(index * BYTES_PER_PIXEL, (index + 1) * BYTES_PER_PIXEL);
  const segments = strip.length / BYTES_PER_PIXEL;
  await expect.poll(() => columnEnds(barcode)).toEqual({ top: segment(segments - 1), bottom: segment(0) });

  await page.getByRole('radio', { name: 'Average' }).check();
  const mean = LinearRgb.average({ width: segments, height: 1, data: Uint8ClampedArray.from(strip) })?.toSrgb().toBytes();
  const average = [...(mean ?? []), MAX_BYTE];
  await expect.poll(() => columnEnds(barcode)).toEqual({ top: average, bottom: average });

  await page.getByRole('radio', { name: 'Strip' }).check();
  await expect.poll(() => columnEnds(barcode)).toEqual({ top: segment(segments - 1), bottom: segment(0) });
});

test('shows a painting’s label while its bar is pointed at, and opens its page on a click', async ({ page }) => {
  await page.goto(`/artist.html?id=${BOTTICELLI.id}`);
  const barcode = page.getByRole('img', { name: /^Career Barcode/ });
  const label = page.locator('.barcode-label');
  await expect(label).toBeHidden();
  await barcode.hover();
  await expect(label).toBeVisible();
  await expect(label).toHaveText('Calumny of Apelles1490s');
  await barcode.click();
  await expect(page).toHaveURL(new RegExp(`/painting(\\.html)?\\?id=${BOTTICELLI.painting}$`));
});

test('shows all of an artist’s page on a laptop’s screen, without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/artist.html?id=${BOTTICELLI.id}`);
  await expect(page.getByRole('img', { name: /^Career Barcode/ })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('radio', { name: 'Average' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(720);
});

test('says so when an artist isn’t in the Atlas, and leads back to it', async ({ page }) => {
  await page.goto('/artist.html?id=Q1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This artist isn’t in the Atlas.');
  await expect(page.getByRole('main').getByRole('link', { name: 'Atlas' })).toHaveAttribute('href', './atlas.html');
});
