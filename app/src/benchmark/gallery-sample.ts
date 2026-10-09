import type { RgbaImage } from '@palette-atlas/color';
import { SOURCE_WIDTH } from '@palette-atlas/gallery';
import { type GalleryEntry, GalleryData } from '../atlas/gallery-data.ts';
import { dateOf, lifespanOf, nameOf, titleOf } from '../atlas/painting-text.ts';
import { fetchOk } from '../fetching.ts';
import { imageCanvas } from '../image-adapters.ts';
import { StripReader } from '../studio/strip-reader.ts';

/** How many paintings the sample shows. */
const SAMPLE_SIZE = 20;

/**
 * The pipeline's check page: random paintings from its output, each with the color strip it
 * stored, and whether the browser reads the very same strip from the same image file on Commons.
 */
export class GallerySample {
  readonly element = document.createElement('section');
  readonly #list = document.createElement('div');

  constructor() {
    this.element.className = 'gallery-sample';
    this.element.innerHTML = `
      <h2>Gallery: ${SAMPLE_SIZE} random paintings <button type="button">Shuffle</button></h2>
      <p>The color strip the pipeline stored for each painting (<code>pnpm paintings</code>), and
        whether the browser reads the very same strip from the same image file on Wikimedia Commons.</p>
    `;
    this.#list.className = 'samples';
    this.element.append(this.#list);
  }

  async load(): Promise<void> {
    const data = await GalleryData.load().catch(() => undefined);
    if (!data) {
      this.#list.textContent = 'No paintings yet: run pnpm paintings.';
      return;
    }
    const reader = new StripReader();
    const shuffle = async (): Promise<void> => {
      const entries = await Promise.all(randomPositions(data.count).map((position) => data.entry(position)));
      this.#list.replaceChildren(...entries.map((entry) => sampleRow(entry, reader)));
    };
    this.element.querySelector('button')?.addEventListener('click', () => void shuffle());
    await shuffle();
  }
}

/** Up to SAMPLE_SIZE distinct positions below `count`, in random order. */
function randomPositions(count: number): number[] {
  const positions = new Set<number>();
  while (positions.size < Math.min(SAMPLE_SIZE, count)) positions.add(Math.floor(Math.random() * count));
  return [...positions];
}

function sampleRow(entry: GalleryEntry, reader: StripReader): HTMLElement {
  const row = document.createElement('article');
  row.className = 'sample';
  const picture = document.createElement('img');
  picture.alt = '';
  const strips = document.createElement('div');
  strips.className = 'strips';
  strips.append(stripRow('Stored', entry.strip));
  const verdict = document.createElement('p');
  verdict.className = 'verdict';
  verdict.textContent = 'Reading in the browser…';
  row.append(picture, details(entry), strips, verdict);

  void (async () => {
    const image = await (await fetchOk(entry.image.url(SOURCE_WIDTH))).blob();
    picture.src = URL.createObjectURL(image);
    const read = await reader.read(image, ['color']);
    read?.picture.close();
    const browser = read?.strips[0]?.strip.toImage();
    if (browser) strips.append(stripRow('Browser', browser));
    verdict.replaceChildren(browser ? comparison(entry.strip, browser) : 'The browser could not read the image');
  })();
  return row;
}

function details({ painting, artist, image, position }: GalleryEntry): HTMLElement {
  const element = document.createElement('div');
  element.className = 'details';
  element.innerHTML = `
    <b></b><br />
    <span class="artist"></span><br />
    <span class="date"></span> · <span class="collection"></span><br />
    <small>#${position} · ${painting.license === 'cc0' ? 'CC0' : 'Public domain'} ·
      <a href="https://www.wikidata.org/wiki/${painting.id}" target="_blank" rel="noopener">${painting.id}</a> ·
      <a href="${image.page}" target="_blank" rel="noopener">Commons</a></small>
  `;
  // Titles and names come from Wikidata, so they go in as text, never as markup.
  element.querySelector('b')!.textContent = titleOf(painting);
  element.querySelector('.artist')!.textContent = `${nameOf(artist)} (${lifespanOf(artist)})`;
  element.querySelector('.date')!.textContent = `${dateOf(painting)} (${painting.precision})`;
  element.querySelector('.collection')!.textContent = painting.collection ?? 'collection unknown';
  return element;
}

function stripRow(label: string, colors: RgbaImage): HTMLElement {
  const row = document.createElement('div');
  row.className = 'strip-row';
  const name = document.createElement('span');
  name.textContent = label;
  const band = imageCanvas(colors);
  band.className = 'strip';
  row.append(name, band);
  return row;
}

/** Whether the browser's strip matches the stored one, and if not, by how much. */
function comparison(stored: RgbaImage, browser: RgbaImage): string {
  if (browser.data.length !== stored.data.length) return '✗ The browser’s strip has another length';
  let differing = 0;
  let largest = 0;
  for (let byte = 0; byte < stored.data.length; byte++) {
    const difference = Math.abs(stored.data[byte] - browser.data[byte]);
    if (difference > 0) differing++;
    largest = Math.max(largest, difference);
  }
  return differing === 0
    ? '✓ The browser reads the same strip'
    : `✗ ${differing} of ${stored.data.length} bytes differ in the browser, by up to ${largest}`;
}
