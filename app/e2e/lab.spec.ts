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

/** A phone on its side: wide enough for the layers' labels, too short for five of them. */
const PHONE_ON_ITS_SIDE = { width: 844, height: 390 } as const;
/** A phone's screen height, and the room the Lab leaves at its sides there, in CSS pixels. */
const PHONE_HEIGHT = 844;
const PHONE_GUTTER = 16;

test.beforeEach(({ page }) => serveFixtureGallery(page));

/** Takes the replay to its end at once, as dragging its scrubber to the end does, once the search has arrived and set its length. */
async function skipToEnd(page: Page): Promise<void> {
  const replay = page.getByRole('slider', { name: 'Replay' });
  await expect(replay).toHaveAttribute('max', /^\d+$/);
  await replay.press('End');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
}

/** The paintings the Lab shows as the nearest, by their positions in the fixture gallery: its tiles come once their paintings are read, so poll it. */
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
  await expect.poll(() => nearestShown(page)).toEqual(order);
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
  await expect.poll(() => nearestShown(page)).toEqual(order);

  await page.getByRole('link', { name: 'See the matches' }).click();
  await expect(page).toHaveURL(/\/atlas(\.html)?\?match$/);
  await expect(page.locator('.wall .painting-tile')).toHaveCount(order.length);
  expect(await wallTitles(page)).toEqual(order.map((position) => FIXTURE_PAINTINGS[position]?.title));

  await page.goBack();
  await expect(page.getByRole('img', { name: 'Your image' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('img', { name: 'Your image' })).toBeVisible();
  await skipToEnd(page);
  await expect.poll(() => nearestShown(page)).toEqual(order);
});

test('replays the search behind a wall of matches from its How they were found, for an image or a painting', async ({ page }) => {
  await page.goto('/atlas.html');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Match an image' }).click();
  await (await chooser).setFiles(fixtureImage('Q1217187'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Painted in these colors.');
  await expect(page.locator('.wall .painting-tile')).toHaveCount(FIXTURE_PAINTINGS.length);
  const wall = await wallTitles(page);
  expect(wall[0]).toBe('Calumny of Apelles');
  await page.getByRole('link', { name: 'How they were found' }).click();
  await expect(page).toHaveURL(/\/lab(\.html)?\?match$/);
  await expect(page.getByRole('img', { name: 'Your image' })).toBeVisible();
  await skipToEnd(page);
  await expect.poll(async () => (await nearestShown(page)).map((position) => FIXTURE_PAINTINGS[position]?.title)).toEqual(wall);
  // Back on the wall, it is the same image's.
  await page.goBack();
  await expect(page.locator('.wall .painting-tile')).toHaveCount(FIXTURE_PAINTINGS.length);
  expect(await wallTitles(page)).toEqual(wall);

  await page.goto('/atlas.html?like=Q1217187');
  await page.getByRole('link', { name: 'How they were found' }).click();
  await expect(page).toHaveURL(/\/lab(\.html)?\?like=Q1217187$/);
  await expect(page.getByRole('link', { name: 'Calumny of Apelles', exact: true })).toBeVisible();
});

test('opens on the search’s end, still, where the system asks for less motion, and names each layer along the replay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/lab.html?like=Q1217187');
  const replay = page.getByRole('slider', { name: 'Replay' });
  await expect.poll(async () => (await replay.inputValue()) === (await replay.getAttribute('max'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect.poll(() => nearestShown(page)).toEqual([2, 3, 0]);
  await expect(replay).toHaveAttribute('aria-valuetext', 'Layer 0');
  await replay.press('Home');
  await expect(replay).toHaveAttribute('aria-valuetext', 'Layer 1');
});

test('never lets the layers’ labels run into one another, leaving them out where the boards lie too close', async ({ page }) => {
  // The site's own gallery, five layers deep (the fixture's two always have room), its pictures left out.
  await page.unroute('**/data/**');
  for (const size of [PHONE_ON_ITS_SIDE, ...DESKTOP_WINDOWS]) {
    await page.setViewportSize(size);
    await page.goto('/lab.html');
    await skipToEnd(page);
    const where = `${size.width}×${size.height}`;
    const shown = (): Promise<DOMRect[]> =>
      page.locator('.sheet-label').evaluateAll((elements) =>
        elements.filter((label) => label.checkVisibility()).map((label) => label.getBoundingClientRect().toJSON() as DOMRect),
      );
    // A laptop's window has room for them all, once the stage has settled.
    if (size.width >= 1280) await expect.poll(async () => (await shown()).length, where).toBe(5);
    const labels = await shown();
    for (let below = 1; below < labels.length; below++) expect(labels[below].top, where).toBeGreaterThanOrEqual(labels[below - 1].bottom);
  }
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
  // copy in the magnifier, which names nothing. Its name is at hand once its tile has come.
  await expect.poll(() => nearestShown(page)).toContain(2);
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

test('moves the magnifier where it is dragged, within the boards, and names nothing behind it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto('/lab.html?like=Q1217187');
  await skipToEnd(page);
  const glass = page.locator('.magnifier');
  const middle = async (): Promise<{ x: number; y: number }> => {
    const box = await glass.boundingBox();
    if (!box) throw new Error('The magnifier is not laid out');
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  // The query sits in the middle of the glass, drawn where the glass is.
  const yellowAt = ({ x, y }: { x: number; y: number }): Promise<boolean> =>
    page.locator('.stack-stage canvas').evaluate(
      (canvas: HTMLCanvasElement, { x, y }) => {
        const box = canvas.getBoundingClientRect();
        const context = canvas.getContext('2d') as CanvasRenderingContext2D;
        const [red, green, blue] = context.getImageData((x - box.left) * devicePixelRatio, (y - box.top) * devicePixelRatio, 1, 1).data;
        return red === 0xff && green === 0xc8 && blue === 0x1f;
      },
      { x, y },
    );
  const start = await middle();
  expect(await yellowAt(start)).toBe(true);
  await page.mouse.move(start.x, start.y);
  await expect(page.locator('.dot-label')).toBeHidden();

  await page.mouse.down();
  await page.mouse.move(start.x - 300, start.y + 60, { steps: 6 });
  await page.mouse.up();
  const moved = await middle();
  expect(moved.x).toBeCloseTo(start.x - 300, 0);
  expect(moved.y).toBeCloseTo(start.y + 60, 0);
  expect(await yellowAt(moved)).toBe(true);

  // Dragged far past them, it stops at the boards' edges: clear of the layers' labels and the pin's head.
  await page.mouse.move(moved.x, moved.y);
  await page.mouse.down();
  await page.mouse.move(0, 0, { steps: 6 });
  await page.mouse.up();
  const [stopped, labels, head, stage] = await Promise.all([
    glass.boundingBox(),
    page.locator('.sheet-label').evaluateAll((all) => Math.max(...all.map((label) => label.getBoundingClientRect().right))),
    page.locator('.pin-head').boundingBox(),
    page.locator('.stack-stage').boundingBox(),
  ]);
  if (!stopped || !head || !stage) throw new Error('The stage is not laid out');
  expect(stopped.x).toBeGreaterThan(labels);
  expect(stopped.y).toBeGreaterThan(head.y + head.height);
  await page.mouse.move(stopped.x + stopped.width / 2, stopped.y + stopped.height / 2);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width + 400, stage.y + stage.height + 400, { steps: 6 });
  await page.mouse.up();
  const corner = await glass.boundingBox();
  if (!corner) throw new Error('The magnifier is not laid out');
  expect(corner.x + corner.width).toBeLessThanOrEqual(stage.x + stage.width);
  expect(corner.y + corner.height).toBeLessThanOrEqual(stage.y + stage.height);
  // Wherever it went, it kept to one side of the pin, which stays in sight.
  const pin = head.x + head.width / 2;
  for (const box of [start, moved].map(({ x }) => ({ x: x - 1, width: 2 })).concat([stopped, corner])) {
    expect(box.x > pin || box.x + box.width < pin).toBe(true);
  }
});

test('shows a phone the headline, the replay and its controls on its first screen, the rest of the panel under them', async ({ page }) => {
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: PHONE_HEIGHT });
    await page.goto('/lab.html?like=Q1217187');
    await skipToEnd(page);
    const boxes = await Promise.all(
      [
        page.getByRole('heading', { level: 1 }),
        page.locator('.stack-stage'),
        page.locator('.lab-transport'),
        page.locator('.measured'),
        page.locator('.lab-query'),
        page.locator('.nearest'),
        page.getByRole('navigation', { name: 'Parts of the site' }),
      ].map((part) => part.boundingBox()),
    );
    if (boxes.some((box) => !box)) throw new Error('The Lab is not laid out');
    const [heading, stack, controls, ...rest] = boxes as { x: number; y: number; width: number; height: number }[];
    const tabs = rest.pop() as { y: number };
    const where = `${width} px`;
    expect(heading.y + heading.height, where).toBeLessThanOrEqual(stack.y);
    expect(stack.y + stack.height, where).toBeLessThanOrEqual(controls.y);
    // Above the switch between the site's parts, which floats at the bottom of the screen.
    expect(controls.y + controls.height, where).toBeLessThanOrEqual(tabs.y);
    // Then how much it measured, what it searched for, and the nearest it found, one under another.
    const panel = [controls, ...rest];
    for (let index = 1; index < panel.length; index++) expect(panel[index - 1].y + panel[index - 1].height, where).toBeLessThanOrEqual(panel[index].y);
    expect(stack.width, where).toBe(width - 2 * PHONE_GUTTER);
  }
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('names a painting tapped on its layers, and opens its page on a tap on its name', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: PHONE_HEIGHT });
    await page.goto('/lab.html?like=Q1217187');
    await skipToEnd(page);
    const { id, title } = FIXTURE_PAINTINGS[2];
    const stack = await page.locator('.stack-stage canvas').boundingBox();
    if (!stack) throw new Error('The stack is not laid out');
    // Its name is at hand once its tile among the nearest has come.
    await expect.poll(() => nearestShown(page)).toContain(2);
    const label = page.locator('.dot-label');
    let named = false;
    for (const { x, y } of await patchesOf(page, mapColor(2))) {
      await page.touchscreen.tap(stack.x + x, stack.y + y);
      if (!(await label.isVisible())) continue;
      await expect(label).toContainText(title);
      // A tap names it, and stays on the page.
      await expect(page).toHaveURL(/\/lab(\.html)?\?like=Q1217187$/);
      named = true;
      await label.tap();
      await expect(page).toHaveURL(new RegExp(`/painting(\\.html)?\\?id=${id}$`));
      break;
    }
    expect(named).toBe(true);
  });
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
