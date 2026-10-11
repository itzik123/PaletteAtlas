import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { fixtureImage, serveFixtureGallery } from './fixture-gallery.ts';

const BENCHMARK = join(import.meta.dirname, '../../benchmark');
/** The rules checked: WCAG 2.2's levels A and AA, and axe's best practices. */
const RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const LAPTOP = { width: 1280, height: 720 } as const;
const PHONE = { width: 390, height: 844 } as const;

/** Every page of the site, and every state it can be brought to: empty or full, a dialog open or not. */
const STATES: readonly { name: string; open: (page: Page) => Promise<void> }[] = [
  { name: 'the Studio, before an image', open: (page) => page.goto('/').then(() => undefined) },
  {
    name: 'the Studio, with an image',
    open: async (page) => {
      await page.goto('/');
      await page.locator('input[type=file]').setInputFiles(join(BENCHMARK, 'cube.webp'));
      await expect(page.getByRole('slider', { name: 'Strip' })).toBeVisible();
    },
  },
  {
    name: 'How it works',
    open: async (page) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'How it works' }).click();
    },
  },
  { name: 'the Atlas', open: (page) => page.goto('/atlas.html').then(() => undefined) },
  {
    name: 'a wall of matches',
    open: async (page) => {
      await page.goto('/atlas.html');
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Match an image' }).click();
      await (await chooser).setFiles(fixtureImage('Q1217187'));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Painted in these colors.');
    },
  },
  { name: 'a painting', open: (page) => page.goto('/painting.html?id=Q1217187').then(() => undefined) },
  {
    name: 'a painting enlarged',
    open: async (page) => {
      await page.goto('/painting.html?id=Q1217187');
      await page.getByRole('button', { name: 'Enlarge' }).click();
      await expect(page.getByRole('dialog', { name: 'Calumny of Apelles' })).toBeVisible();
    },
  },
  { name: 'a Career Barcode', open: (page) => page.goto('/artist.html?id=Q5669').then(() => undefined) },
  {
    name: 'the Lab',
    open: async (page) => {
      await page.goto('/lab.html?like=Q1217187');
      await page.getByRole('slider', { name: 'Replay' }).press('End');
    },
  },
];

/** What axe finds on the page as it is now, each rule broken where. */
async function violations(page: Page): Promise<string[]> {
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page }).withTags(RULES).analyze();
  return violations.flatMap(({ id, nodes }) => nodes.map(({ target }) => `${id}: ${target.join(' ')}`));
}

test.beforeEach(({ page }) => serveFixtureGallery(page));

for (const { name, open } of STATES) {
  for (const [screen, size] of [
    ['a laptop', LAPTOP],
    ['a phone', PHONE],
  ] as const) {
    test(`${name} meets WCAG 2.2 AA on ${screen}, as axe checks it`, async ({ page }) => {
      await page.setViewportSize(size);
      await open(page);
      expect(await violations(page)).toEqual([]);
    });
  }
}

test('the painters on a phone, over the page, meet WCAG 2.2 AA, as axe checks them', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/artist.html?id=Q5669');
  await page.getByRole('button', { name: 'Painters' }).click();
  await expect(page.getByRole('searchbox', { name: 'Find a painter' })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});
