import { GALLERY_FILES, THUMBNAIL_WIDTHS } from '@palette-atlas/gallery';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { byColorScheme } from './color-schemes.ts';
import { FIXTURE_PAINTINGS, fixtureImage, serveFixtureGallery } from './fixture-gallery.ts';
import { canvasColors, storedStrip } from './stored-strips.ts';

/** The axes' strips on a painting's page, by their accessible names. */
const AXIS_STRIPS = ['Color strip', 'Hilbert strip', 'Columns strip', 'Radial strip'];

/** Phones' screens, from the narrowest still in use (320 CSS pixels wide) to the widest (430), every 10. */
const PHONE_SIZES = Array.from({ length: 12 }, (_, step) => ({ width: 320 + 10 * step, height: 800 }));

/** What the Atlas says over the paintings nearest an image's colors, or a painting's. */
const MATCHES_HEADLINE = 'Painted in these colors.';

test.beforeEach(({ page }) => serveFixtureGallery(page));

/** Matches an image, chosen by the Atlas's own button, to the gallery's paintings. */
async function matchImage(page: Page, path: string): Promise<void> {
  await page.goto('/atlas.html');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Match an image' }).click();
  await (await chooser).setFiles(path);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(MATCHES_HEADLINE);
}

/** The titles of the paintings on the wall, in the order they hang. */
async function wallTitles(page: Page): Promise<string[]> {
  return page
    .locator('.wall .painting-tile')
    .evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('aria-label')?.split(', ')[0] ?? ''));
}

/** Where some words of the page's headline lie, from their first letter's line box to their last's. */
async function wordsBox(page: Page, words: string): Promise<{ left: number; right: number; top: number; bottom: number }> {
  return page.getByRole('heading', { level: 1 }).evaluate((heading, words) => {
    const text = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    while (text.nextNode()) {
      const start = text.currentNode.textContent?.indexOf(words) ?? -1;
      if (start < 0) continue;
      const range = document.createRange();
      range.setStart(text.currentNode, start);
      range.setEnd(text.currentNode, start + words.length);
      const { left, right, top, bottom } = range.getBoundingClientRect();
      return { left, right, top, bottom };
    }
    throw new Error(`“${words}” is not in the headline`);
  }, words);
}

/** The fixture's titles at some positions in the gallery. */
function titlesAt(positions: readonly number[]): string[] {
  return positions.map((position) => FIXTURE_PAINTINGS[position]?.title ?? '');
}

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
  const sameColors = page.getByRole('region', { name: 'Same colors' });
  await expect(sameColors.locator('.painting-tile').first()).toBeVisible();
  await expect(sameColors).toBeInViewport({ ratio: 1 });
  // A painting's label opens above it, rather than below the screen's edge.
  await sameColors.locator('.painting-tile').first().hover();
  await expect(sameColors.locator('.tile-label').first()).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(720);
});

test('keeps a painting’s page and its labels within a phone’s screen, so it never pans sideways', async ({ page }) => {
  for (const { id } of FIXTURE_PAINTINGS) {
    await page.goto(`/painting.html?id=${id}`);
    // The paintings in the same colors are hung, or a button leads to them.
    await expect(page.locator('.same-colors')).toHaveAttribute('data-fit', /./);
    for (const size of PHONE_SIZES) {
      await page.setViewportSize(size);
      // Laid out again for the width, the paintings in the same colors hung again, and their labels moved into place.
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.locator('.same-colors').evaluate((same) => Promise.all(same.getAnimations({ subtree: true }).map(({ finished }) => finished)));
      const where = `${id} at ${size.width} px`;
      expect(await page.evaluate(() => document.documentElement.scrollWidth), where).toBe(size.width);
      // Each painting's label opens over it, but never past its row's ends.
      const pastRow = await page.locator('.same-colors-row').evaluate((row) => {
        const { left, right } = row.getBoundingClientRect();
        return [...row.querySelectorAll('.tile-label')]
          .map((label) => label.getBoundingClientRect())
          .filter((label) => label.left < left - 0.5 || label.right > right + 0.5).length;
      });
      expect(pastRow, where).toBe(0);
    }
  }
});

test('matches an image to the paintings nearest its colors: they hang first, the image on a card beside them', async ({ page }) => {
  await matchImage(page, fixtureImage('Q1217187'));
  await expect(page).toHaveURL(/\/atlas(\.html)?\?match$/);
  // The browser reads the image's color strip as the pipeline read the painting's from the same file.
  const colors = await storedStrip(page, GALLERY_FILES.gallery, 1);
  await expect(page.getByRole('img', { name: 'Your image' })).toBeVisible();
  expect(await canvasColors(page.locator('.query-strip'))).toEqual(colors);
  // Its strip stands under the words that name it, on phones and laptops alike.
  for (const size of [...PHONE_SIZES, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    const [strip, words] = await Promise.all([page.locator('.query-strip').boundingBox(), wordsBox(page, 'these colors.')]);
    if (!strip) throw new Error('The strip is not laid out');
    const where = `${size.width}×${size.height}`;
    expect(Math.abs(strip.x - words.left), where).toBeLessThan(2);
    expect(Math.abs(strip.x + strip.width - words.right), where).toBeLessThan(2);
    expect(strip.y, where).toBeGreaterThan(words.top);
    expect(strip.y, where).toBeLessThan(words.bottom);
  }
  const order = await byColorScheme(page, colors);
  expect(order[0]).toBe(1);
  await expect(page.locator('.wall .painting-tile')).toHaveCount(order.length);
  expect(await wallTitles(page)).toEqual(titlesAt(order));

  await page.getByRole('link', { name: 'All paintings' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^4 paintings/);
  // The headline comes before the paintings, which hang once their chunks arrive.
  await expect(page.locator('.wall .painting-tile')).toHaveCount(FIXTURE_PAINTINGS.length);
  expect(await wallTitles(page)).toEqual(titlesAt([0, 1, 2, 3]));
});

test('comes back to the same matches from a painting, and keeps them on reloading', async ({ page }) => {
  await matchImage(page, fixtureImage('Q18748372'));
  const tiles = page.locator('.wall .painting-tile');
  await expect(tiles).toHaveCount(FIXTURE_PAINTINGS.length);
  const matches = await wallTitles(page);

  await tiles.nth(1).click();
  await page.getByRole('main').getByRole('link', { name: 'Atlas' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(MATCHES_HEADLINE);
  await expect(tiles).toHaveCount(FIXTURE_PAINTINGS.length);
  expect(await wallTitles(page)).toEqual(matches);

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(MATCHES_HEADLINE);
  await expect(tiles).toHaveCount(FIXTURE_PAINTINGS.length);
  expect(await wallTitles(page)).toEqual(matches);
});

test('shows the paintings nearest a painting’s colors under its strips, and the rest of them on the wall', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto('/painting.html?id=Q1217187');
  const order = (await byColorScheme(page, await storedStrip(page, GALLERY_FILES.gallery, 1))).filter((position) => position !== 1);
  const sameColors = page.getByRole('region', { name: 'Same colors' });
  const tiles = sameColors.locator('.painting-tile');
  await expect(tiles.first()).toBeVisible();
  // As many as fit in a row, the nearest first, and never the painting itself.
  const shown = await tiles.evaluateAll((elements) => elements.map((tile) => tile.getAttribute('href')));
  expect(shown).toEqual(order.slice(0, shown.length).map((position) => `./painting.html?id=${FIXTURE_PAINTINGS[position]?.id}`));

  await sameColors.getByRole('link', { name: 'Same colors' }).click();
  await expect(page).toHaveURL(/\/atlas(\.html)?\?like=Q1217187$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(MATCHES_HEADLINE);
  await expect(page.locator('.query-card')).toHaveAttribute('href', './painting.html?id=Q1217187');
  await expect(page.locator('.wall .painting-tile')).toHaveCount(order.length);
  expect(await wallTitles(page)).toEqual(titlesAt(order));
});

test('keeps the headline beside a wide painting’s card within a phone’s screen', async ({ page }) => {
  // Vroom's View of the IJ is 2.76 times as wide as it is tall.
  await page.goto('/atlas.html?like=Q17812507');
  await expect(page.locator('.query-strip')).toBeVisible();
  for (const size of PHONE_SIZES) {
    await page.setViewportSize(size);
    const [words, top] = await Promise.all([wordsBox(page, 'these colors.'), page.locator('.matches-top').boundingBox()]);
    expect(words.right, `${size.width} px`).toBeLessThanOrEqual((top?.x ?? 0) + (top?.width ?? 0));
  }
});

test('leads to the same colors by a button where a painting’s page has no room for a row of them', async ({ page }) => {
  // Under Vroom's View of the IJ, 2.76 times as wide as it is tall, a laptop's screen has no room left.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/painting.html?id=Q17812507');
  const sameColors = page.getByRole('region', { name: 'Same colors' });
  await expect(sameColors.getByRole('link', { name: 'Same colors' })).toHaveAttribute('href', './atlas.html?like=Q17812507');
  await expect(sameColors.locator('.painting-tile')).toHaveCount(0);
  await expect(sameColors).toBeInViewport({ ratio: 1 });
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

/** The most of the screen's height, or of its width, left round a painting enlarged as large as fits, in CSS pixels. */
const ROOM_ROUND_ENLARGED = 100;

/**
 * Expects a painting enlarged as large as the screen allows, its frame reaching near the screen's
 * edges, top and bottom or either side, and Commons asked for its picture at least as wide as it
 * is shown (the fixture serves the same small file at every width, so the link tells).
 */
async function expectAsLargeAsFits(enlarged: Locator): Promise<void> {
  await expect(enlarged).toBeVisible();
  const room = await enlarged.evaluate((frame: HTMLElement) =>
    Math.min(innerWidth - frame.offsetWidth, innerHeight - frame.offsetHeight),
  );
  expect(room).toBeLessThan(ROOM_ROUND_ENLARGED);
  await expect
    .poll(() =>
      enlarged.locator('img').evaluate((picture: HTMLImageElement) => {
        if (!picture.complete || picture.naturalWidth === 0) return 0;
        // A link to the file itself names no width: it is the widest there is.
        const asked = /\/(\d+)px-[^/]*$/.exec(picture.currentSrc)?.[1];
        return (asked ? Number(asked) : Number.POSITIVE_INFINITY) / (picture.clientWidth * devicePixelRatio);
      }),
    )
    .toBeGreaterThanOrEqual(1);
}

test('enlarges a painting over its page on a click, and puts it away on another, or on Escape', async ({ page }) => {
  await page.goto('/painting.html?id=Q1217187');
  const picture = page.getByRole('img', { name: 'Calumny of Apelles' });
  const enlarged = page.getByRole('dialog', { name: 'Calumny of Apelles' });
  await expect.poll(() => picture.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await picture.click();
  await expectAsLargeAsFits(enlarged);
  await expect(enlarged).toHaveCSS('outline-style', 'none');
  await page.mouse.click(8, 8);
  await expect(enlarged).toBeHidden();
  await picture.click();
  await expect(enlarged).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(enlarged).toBeHidden();
});

test('enlarges a painting as large as fits when clicked before its picture has arrived', async ({ page }) => {
  // Commons's pictures held back until the painting has been clicked, as on a slow connection.
  let arrive = (): void => {};
  const arrived = new Promise<void>((resolve) => (arrive = resolve));
  await page.route(/^https:\/\/(thumb|upload)\.wikimedia\.org\//, async (route) => {
    await arrived;
    await route.fallback();
  });
  await page.goto('/painting.html?id=Q1217187');
  await page.getByRole('img', { name: 'Calumny of Apelles' }).click();
  arrive();
  await expectAsLargeAsFits(page.getByRole('dialog', { name: 'Calumny of Apelles' }));
});
