import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { type Download, expect, type Locator, type Page, test } from '@playwright/test';

const BENCHMARK = join(import.meta.dirname, '../../benchmark');
/** Each segment's width in the reference strips that `pnpm strips` draws. */
const REFERENCE_BAND_WIDTH = 8;

/** The longest the page may stay busy at one stretch while an image is read; longer, and it visibly freezes. */
const LONGEST_TASK_MS = 100;

declare global {
  interface Window {
    /** How long each long task on the page's main thread took, in milliseconds. */
    longTasks: number[];
  }
}

/** The axes as the Studio names them, by the names of the reference strips' files. */
const AXES = [
  { file: 'color', label: 'Color' },
  { file: 'hilbert', label: 'Hilbert' },
  { file: 'columns', label: 'Columns' },
  { file: 'radial', label: 'Radial' },
] as const;

/** Drops a file on an element, as the browser does when one is dragged in from the desktop. */
async function dropFile(page: Page, target: Locator, path: string, type: string): Promise<void> {
  const bytes = (await readFile(path)).toString('base64');
  const dataTransfer = await page.evaluateHandle(
    ({ bytes, name, type }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([Uint8Array.from(atob(bytes), (char) => char.charCodeAt(0))], name, { type }));
      return transfer;
    },
    { bytes, name: basename(path), type },
  );
  for (const event of ['dragenter', 'dragover', 'drop']) await target.dispatchEvent(event, { dataTransfer });
}

/** The colors the Studio's strip shows, four bytes per segment. */
function stripColors(page: Page): Promise<number[]> {
  return page.getByRole('img', { name: 'Strip' }).evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not available');
    return Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data);
  });
}

/** The colors of a reference strip in benchmark/strips, four bytes per segment, decoded by the browser. */
async function referenceColors(page: Page, image: string, axis: string): Promise<number[]> {
  const bytes = (await readFile(join(BENCHMARK, 'strips', `${image}-${axis}.png`))).toString('base64');
  return page.evaluate(
    async ({ bytes, bandWidth }) => {
      const png = new Blob([Uint8Array.from(atob(bytes), (char) => char.charCodeAt(0))], { type: 'image/png' });
      const bitmap = await createImageBitmap(png, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      const context = new OffscreenCanvas(bitmap.width, 1).getContext('2d');
      if (!context) throw new Error('Canvas 2D is not available');
      context.drawImage(bitmap, 0, 0);
      const row = context.getImageData(0, 0, bitmap.width, 1).data;
      const colors: number[] = [];
      for (let x = 0; x < bitmap.width; x += bandWidth) colors.push(...row.subarray(x * 4, x * 4 + 4));
      return colors;
    },
    { bytes, bandWidth: REFERENCE_BAND_WIDTH },
  );
}

/** The middle of a segment's band on the Studio's strip, in page coordinates. */
function segmentPoint(page: Page, segment: number): Promise<{ x: number; y: number }> {
  return page.getByRole('img', { name: 'Strip' }).evaluate((canvas: HTMLCanvasElement, segment) => {
    const box = canvas.getBoundingClientRect();
    return {
      x: box.left + canvas.clientLeft + ((segment + 0.5) / canvas.width) * canvas.clientWidth,
      y: box.top + canvas.clientTop + canvas.clientHeight / 2,
    };
  }, segment);
}

/**
 * The veil over the picture, column by column: "c" where every pixel is clear, "v" where every
 * pixel is veiled, and "m" where the column is mixed.
 */
function veilColumns(page: Page): Promise<string> {
  return page.locator('.source-veil').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not available');
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    let columns = '';
    for (let x = 0; x < width; x++) {
      let clear = 0;
      for (let y = 0; y < height; y++) if (data[(y * width + x) * 4 + 3] === 0) clear++;
      columns += clear === height ? 'c' : clear === 0 ? 'v' : 'm';
    }
    return columns;
  });
}

/** What veilColumns gives when only the given columns of a picture this wide are clear. */
function clearOnly(columns: readonly number[], width: number): string {
  return Array.from({ length: width }, (_, x) => (columns.includes(x) ? 'c' : 'v')).join('');
}

/** Colors as "r,g,b,a", four bytes each, with every run of one color counted once. */
function runs(bytes: readonly number[]): string[] {
  const colors: string[] = [];
  for (let index = 0; index < bytes.length; index += 4) {
    const color = bytes.slice(index, index + 4).join(',');
    if (colors.at(-1) !== color) colors.push(color);
  }
  return colors;
}

/**
 * A downloaded PNG's size, and its pixels along the vertical and the horizontal line through the
 * point at the given fractions of its width and height, decoded by the browser.
 */
async function savedImage(page: Page, download: Download, at: { x: number; y: number }) {
  const bytes = (await readFile(await download.path())).toString('base64');
  return page.evaluate(
    async ({ bytes, at }) => {
      const png = new Blob([Uint8Array.from(atob(bytes), (char) => char.charCodeAt(0))], { type: 'image/png' });
      const bitmap = await createImageBitmap(png, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      const { width, height } = bitmap;
      const context = new OffscreenCanvas(width, height).getContext('2d');
      if (!context) throw new Error('Canvas 2D is not available');
      context.drawImage(bitmap, 0, 0);
      const column = context.getImageData(Math.floor(at.x * width), 0, 1, height).data;
      const row = context.getImageData(0, Math.floor(at.y * height), width, 1).data;
      return { width, height, column: Array.from(column), row: Array.from(row) };
    },
    { bytes, at },
  );
}

/** Clicks a button that saves a file, and returns the download. */
async function save(page: Page, button: string): Promise<Download> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: button }).click()]);
  return download;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

// The Studio and the pipeline read strips with the same code, so a benchmark image dropped in the
// browser must come out exactly as its reference strips, drawn by sharp in Node.
test('a dropped image becomes the strip the pipeline draws for it, along every axis', async ({ page }) => {
  await dropFile(page, page.getByRole('button', { name: /drop an image/i }), join(BENCHMARK, 'cube.webp'), 'image/webp');
  for (const { file, label } of AXES) {
    await page.getByRole('radio', { name: label }).check();
    await expect.poll(() => stripColors(page), { message: `cube, ${label}` }).toEqual(await referenceColors(page, 'cube', file));
  }
});

test('an image chosen from the file picker becomes its color strip', async ({ page }) => {
  await page.locator('input[type=file]').setInputFiles(join(BENCHMARK, 'laptop.webp'));
  await expect(page.getByRole('radio', { name: 'Color' })).toBeChecked();
  await expect.poll(() => stripColors(page)).toEqual(await referenceColors(page, 'laptop', 'color'));
});

// Reading the strips of a large image takes a few hundred milliseconds of work, which must happen
// away from the page's main thread, or the page stops answering clicks and drawing meanwhile.
test('reading an image never freezes the page', async ({ page }) => {
  await page.evaluate(() => {
    window.longTasks = [];
    new PerformanceObserver((list) => window.longTasks.push(...list.getEntries().map(({ duration }) => duration))).observe({
      type: 'longtask',
    });
  });
  await page.locator('input[type=file]').setInputFiles(join(BENCHMARK, 'chess.webp'));
  await expect.poll(() => stripColors(page)).toEqual(await referenceColors(page, 'chess', 'color'));
  expect(Math.max(0, ...(await page.evaluate(() => window.longTasks)))).toBeLessThan(LONGEST_TASK_MS);
});

test('a dropped file that is not an image is turned away', async ({ page }) => {
  await dropFile(page, page.getByRole('button', { name: /drop an image/i }), join(BENCHMARK, 'README.md'), 'text/markdown');
  await expect(page.getByRole('alert')).toContainText('not an image');
  await expect(page.getByRole('img', { name: 'Strip' })).toBeHidden();
});

// The cube shrinks to 256 × 256 pixels, so along the columns axis each of the 128 segments is
// two pixel columns wide: segment k holds columns 2k and 2k + 1.
const SHRUNK_CUBE = 256;

test('hovering the strip uncovers the pixels its segment came from, and leaving it covers nothing', async ({ page }) => {
  await dropFile(page, page.getByRole('button', { name: /drop an image/i }), join(BENCHMARK, 'cube.webp'), 'image/webp');
  await page.getByRole('radio', { name: 'Columns' }).check();
  const { x, y } = await segmentPoint(page, 40);
  await page.mouse.move(x, y);
  await expect.poll(() => veilColumns(page)).toBe(clearOnly([80, 81], SHRUNK_CUBE));
  await page.mouse.move(0, 0);
  await expect.poll(() => veilColumns(page)).toBe('c'.repeat(SHRUNK_CUBE));
});

test('hovering the picture marks its segment on the strip and uncovers the pixels of that segment', async ({ page }) => {
  await dropFile(page, page.getByRole('button', { name: /drop an image/i }), join(BENCHMARK, 'cube.webp'), 'image/webp');
  await page.getByRole('radio', { name: 'Columns' }).check();
  const picture = await page.getByRole('img', { name: 'cube.webp' }).boundingBox();
  if (!picture) throw new Error('The picture is not shown');
  // 30% across the picture is column 76 of the shrunk image, in segment 38.
  await page.mouse.move(picture.x + 0.3 * picture.width, picture.y + 0.5 * picture.height);
  await expect.poll(() => veilColumns(page)).toBe(clearOnly([76, 77], SHRUNK_CUBE));
  const marker = await page.locator('.segment-marker').boundingBox();
  if (!marker) throw new Error('The strip shows no marker');
  expect(marker.x + marker.width / 2).toBeCloseTo((await segmentPoint(page, 38)).x, 0);
});

test('the strip saves as a phone wallpaper, its colors running top to bottom from edge to edge', async ({ page }) => {
  await page.locator('input[type=file]').setInputFiles(join(BENCHMARK, 'cube.webp'));
  await page.getByRole('radio', { name: 'Radial' }).check();
  await expect.poll(() => stripColors(page)).toEqual(await referenceColors(page, 'cube', 'radial'));
  const download = await save(page, 'Wallpaper');
  expect(download.suggestedFilename()).toBe('cube-radial-wallpaper.png');
  const saved = await savedImage(page, download, { x: 0.5, y: 0.5 });
  expect([saved.width, saved.height]).toEqual([1440, 3120]);
  expect(runs(saved.column)).toEqual(runs(await stripColors(page)));
  expect(runs(saved.row)).toHaveLength(1);
});

test('the strip saves as a poster, its colors running left to right inside a frame', async ({ page }) => {
  await page.locator('input[type=file]').setInputFiles(join(BENCHMARK, 'chess.webp'));
  await page.getByRole('radio', { name: 'Hilbert' }).check();
  await expect.poll(() => stripColors(page)).toEqual(await referenceColors(page, 'chess', 'hilbert'));
  const download = await save(page, 'Poster');
  expect(download.suggestedFilename()).toBe('chess-hilbert-poster.png');
  const saved = await savedImage(page, download, { x: 0.5, y: 0.4 });
  expect([saved.width, saved.height]).toEqual([2400, 3600]);
  const across = runs(saved.row);
  const strip = runs(await stripColors(page));
  // The strip's colors in order, with the paper and the frame on either side.
  expect(across.join(' ')).toContain(strip.join(' '));
  expect(across.length).toBeGreaterThan(strip.length);
});
