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
/** Vroom, whose career comes third. */
const VROOM = { id: 'Q578067', name: 'Hendrick Cornelisz Vroom', career: 2 } as const;
/** The fixture's painters, every one with a career of one painting: the most famous first, and from A to Z by family name. */
const BY_FAME = ['Jan van Eyck', BOTTICELLI.name, VROOM.name, 'Amico Aspertini'] as const;
const A_TO_Z = ['Amico Aspertini', BOTTICELLI.name, 'Jan van Eyck', VROOM.name] as const;

test.beforeEach(({ page }) => serveFixtureGallery(page));

/** The colors at the top and the bottom of a painting's bar, as each fill shows its stored strip: its ends, the darker at the bottom, or its average color all down it. */
function barEnds(strip: readonly number[]): Record<'strip' | 'average', { top: number[]; bottom: number[] }> {
  const segments = strip.length / BYTES_PER_PIXEL;
  const segment = (index: number): number[] => strip.slice(index * BYTES_PER_PIXEL, (index + 1) * BYTES_PER_PIXEL);
  const mean = LinearRgb.average({ width: segments, height: 1, data: Uint8ClampedArray.from(strip) })?.toSrgb().toBytes();
  const average = [...(mean ?? []), MAX_BYTE];
  return { strip: { top: segment(segments - 1), bottom: segment(0) }, average: { top: average, bottom: average } };
}

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
  const link = page.getByRole('link', { name: 'Career Barcode', exact: true });
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
  await expect(page.getByRole('link', { name: 'Career Barcode', exact: true })).toHaveCount(0);
});

test('draws every painting of a career as a bar of its color strip, the darker end at the bottom, or of its average color', async ({
  page,
}) => {
  await page.goto(`/artist.html?id=${BOTTICELLI.id}`);
  const barcode = page.getByRole('img', { name: 'Career Barcode: 1 painting, 1495' });
  await expect(barcode).toBeVisible();
  // The strip is the one the pipeline stored for his career; his one painting's bar spans the barcode.
  const bar = barEnds(await storedStrip(page, GALLERY_FILES.careers, BOTTICELLI.career));
  await expect.poll(() => columnEnds(barcode)).toEqual(bar.strip);

  await page.getByRole('radio', { name: 'Average' }).check();
  await expect.poll(() => columnEnds(barcode)).toEqual(bar.average);

  await page.getByRole('radio', { name: 'Strip' }).check();
  await expect.poll(() => columnEnds(barcode)).toEqual(bar.strip);
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

test('leads from the Atlas to the Career Barcodes, open at the most famous painter', async ({ page }) => {
  await page.goto('/atlas.html');
  await page.getByRole('link', { name: 'Career Barcodes' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(BY_FAME[0]);
  // The address names the painter shown, for a reload or the way back from one of their paintings.
  await expect(page).toHaveURL(/\/artist(\.html)?\?id=Q102272$/);
});

test('lists the most famous painters first, then every painter from A to Z by family name, with a rail of their letters', async ({
  page,
}) => {
  await page.goto('/artist.html');
  const list = page.getByRole('dialog', { name: 'Painters' });
  await expect(list.getByRole('heading', { level: 2 })).toHaveText(['Popular', 'A', 'B', 'E', 'V']);
  await expect(list.locator('.painter-section').first().locator('.painter-name')).toHaveText(BY_FAME);
  await expect(list.locator('.painter-section + .painter-section .painter-name')).toHaveText(A_TO_Z);
  const rail = page.getByRole('navigation', { name: 'Painters by letter' });
  await expect(rail.getByRole('button', { name: 'E', exact: true })).toBeEnabled();
  await expect(rail.getByRole('button', { name: 'C', exact: true })).toBeDisabled();
});

test('jumps to the painters filed under a letter of the rail', async ({ page }) => {
  await page.goto('/artist.html');
  const filedUnderV = page.locator('.painter-section', { has: page.getByRole('heading', { name: 'V', exact: true }) }).getByRole('link');
  await expect(filedUnderV).not.toBeInViewport();
  const v = page.getByRole('navigation', { name: 'Painters by letter' }).getByRole('button', { name: 'V', exact: true });
  await v.click();
  await expect(filedUnderV).toBeInViewport();
  await expect(v).toHaveAttribute('data-current');
});

test('shows a painter picked in the list in place, their bars in the fill picked before', async ({ page }) => {
  await page.goto(`/artist.html?id=${BOTTICELLI.id}`);
  await page.getByRole('radio', { name: 'Average' }).check();
  // A mark on the page, which a page loaded anew wouldn't have.
  await page.evaluate(() => document.body.setAttribute('data-stayed', ''));
  const vroom = page.getByRole('dialog', { name: 'Painters' }).getByRole('link', { name: new RegExp(`^${VROOM.name}`) }).first();
  await vroom.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(VROOM.name);
  await expect(page).toHaveTitle(`${VROOM.name} · Palette Atlas`);
  await expect(page).toHaveURL(new RegExp(`/artist(\\.html)?\\?id=${VROOM.id}$`));
  await expect(page.locator('body')).toHaveAttribute('data-stayed');
  await expect(vroom).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('radio', { name: 'Average' })).toBeChecked();
  const bar = barEnds(await storedStrip(page, GALLERY_FILES.careers, VROOM.career));
  await expect.poll(() => columnEnds(page.getByRole('img', { name: /^Career Barcode/ }))).toEqual(bar.average);
});

test('finds a painter by a name the gallery leaves out or with slips in spelling, and shows the best match on Enter', async ({
  page,
}) => {
  await page.goto('/artist.html');
  const search = page.getByRole('searchbox', { name: 'Find a painter' });
  const found = page.locator('.painter-scroll:not([hidden]) .painter-name');
  await search.fill('Sandro Filipepi Botticelli');
  await expect(found).toHaveText([BOTTICELLI.name]);
  await search.fill('hendrik vrom');
  await expect(found).toHaveText([VROOM.name]);
  // The arrow keys move along the search's text rather than from painter to painter.
  await search.press('ArrowLeft');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(BY_FAME[0]);
  await search.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(VROOM.name);

  await search.fill('Picasso');
  await expect(page.getByText('No painter by that name')).toBeVisible();
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(page.getByRole('heading', { level: 2, name: 'Popular' })).toBeVisible();
});

test('goes on to the painter before or after in the list, by the buttons or the arrow keys, round from the last to the first', async ({
  page,
}) => {
  await page.goto('/artist.html');
  const name = page.getByRole('heading', { level: 1 });
  await expect(name).toHaveText(BY_FAME[0]);
  const next = page.getByRole('button', { name: 'Next painter' });
  await next.hover();
  await expect(next.locator('.tooltip')).toHaveText(BOTTICELLI.name);
  await next.click();
  await expect(name).toHaveText(BOTTICELLI.name);
  await page.keyboard.press('ArrowRight');
  await expect(name).toHaveText(VROOM.name);
  await page.keyboard.press('ArrowRight');
  await expect(name).toHaveText('Amico Aspertini');
  // On from the most famous to A to Z, where Aspertini comes first again.
  await page.keyboard.press('ArrowRight');
  await expect(name).toHaveText(BOTTICELLI.name);

  await page.goto('/artist.html');
  await expect(name).toHaveText(BY_FAME[0]);
  await page.getByRole('button', { name: 'Previous painter' }).click();
  await expect(name).toHaveText(A_TO_Z[3]);
});

test('opens the list over the page on a phone, and closes it as a painter is picked', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`/artist.html?id=${BOTTICELLI.id}`);
  const list = page.getByRole('dialog', { name: 'Painters' });
  const open = page.getByRole('button', { name: 'Painters', exact: true });
  await expect(list).toBeHidden();
  await open.click();
  await expect(list).toBeVisible();
  await list.getByRole('link', { name: /^Amico Aspertini/ }).first().click();
  await expect(list).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Amico Aspertini');
  await open.click();
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
});
