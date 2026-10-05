import { BYTES_PER_PIXEL, type RgbaImage } from '@palette-atlas/color';
import type { AxisName, NamedStrip } from '@palette-atlas/strip';
import { imageCanvas } from '../image-adapters.ts';
import { StripReader } from '../studio/strip-reader.ts';
import { AtlasStrips, DATA_URL, type Painting, type PaintingsFile } from './atlas-strips.ts';

/** How many paintings the sample shows. */
const SAMPLE_SIZE = 20;
const AXIS_LABELS: Readonly<Record<AxisName, string>> = { columns: 'Columns', radial: 'Radial', hilbert: 'Hilbert', color: 'Color' };

/**
 * The pipeline's check page: random paintings from its output, each with the strips it stored
 * for them, and whether the browser reads the same strips from the same image file on Commons.
 */
export class GallerySample {
  readonly element = document.createElement('section');
  readonly #list = document.createElement('div');

  constructor() {
    this.element.className = 'gallery-sample';
    this.element.innerHTML = `
      <h2>Gallery: ${SAMPLE_SIZE} random paintings <button type="button">Shuffle</button></h2>
      <p>The strips the pipeline stored for each painting (<code>pnpm paintings</code>), and whether
        the browser reads the very same strips from the same image file on Wikimedia Commons.</p>
    `;
    this.#list.className = 'samples';
    this.element.append(this.#list);
  }

  async load(): Promise<void> {
    const response = await fetch(`${DATA_URL}paintings.json`);
    if (!response.ok) {
      this.#list.textContent = 'No paintings yet: run pnpm paintings.';
      return;
    }
    const paintings = (await response.json()) as PaintingsFile;
    const atlas = new AtlasStrips(paintings);
    const reader = new StripReader();
    const shuffle = (): void => {
      this.#list.replaceChildren(...randomIndexes(paintings.paintings.length).map((index) => sampleRow(paintings, index, atlas, reader)));
    };
    this.element.querySelector('button')?.addEventListener('click', shuffle);
    shuffle();
  }
}

/** Up to SAMPLE_SIZE distinct indexes below `count`, in random order. */
function randomIndexes(count: number): number[] {
  const indexes = new Set<number>();
  while (indexes.size < Math.min(SAMPLE_SIZE, count)) indexes.add(Math.floor(Math.random() * count));
  return [...indexes];
}

function sampleRow(paintings: PaintingsFile, index: number, atlas: AtlasStrips, reader: StripReader): HTMLElement {
  const painting = paintings.paintings[index];
  const row = document.createElement('article');
  row.className = 'sample';
  const picture = document.createElement('img');
  picture.alt = '';
  const strips = document.createElement('div');
  strips.className = 'strips';
  const verdict = document.createElement('p');
  verdict.className = 'verdict';
  verdict.textContent = 'Reading in the browser…';
  row.append(picture, details(paintings, painting, index), strips, verdict);

  void (async () => {
    const stored = await Promise.all(paintings.axes.map(async (axis) => ({ axis, colors: await atlas.strip(axis, index) })));
    for (const { axis, colors } of stored) strips.append(stripRow(AXIS_LABELS[axis], colors));
    const image = await fetch(painting.thumbnail).then((response) => response.blob());
    picture.src = URL.createObjectURL(image);
    const read = await reader.read(image);
    verdict.replaceChildren(read ? comparison(stored, read.strips) : 'The browser could not read the image');
  })();
  return row;
}

function details(paintings: PaintingsFile, painting: Painting, index: number): HTMLElement {
  const artist = paintings.artists[painting.artist];
  const lifespan = artist.born === null ? `d. ${artist.died}` : `${artist.born}–${artist.died}`;
  const element = document.createElement('div');
  element.className = 'details';
  element.innerHTML = `
    <b></b><br />
    <span class="artist"></span> (${lifespan})<br />
    ${painting.year} (${painting.precision}) · <span class="collection"></span><br />
    <small>#${index} · ${painting.license === 'cc0' ? 'CC0' : 'Public domain'} ·
      <a href="https://www.wikidata.org/wiki/${painting.id}" target="_blank" rel="noopener">${painting.id}</a> ·
      <a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(painting.file)}" target="_blank" rel="noopener">Commons</a></small>
  `;
  // Titles and names come from Wikidata, so they go in as text, never as markup.
  element.querySelector('b')!.textContent = painting.title ?? 'Untitled';
  element.querySelector('.artist')!.textContent = artist.name ?? 'Unknown artist';
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

/** Whether the browser's strips match the stored ones, and if not, by how much. */
function comparison(stored: readonly { axis: AxisName; colors: RgbaImage }[], read: readonly NamedStrip[]): string {
  let differing = 0;
  let largest = 0;
  for (const { axis, colors } of stored) {
    const browser = read.find((strip) => strip.axis === axis)?.strip.toImage().data;
    if (browser?.length !== colors.data.length) return `✗ The browser's ${axis} strip has another length`;
    for (let byte = 0; byte < colors.data.length; byte++) {
      const difference = Math.abs(colors.data[byte] - browser[byte]);
      if (difference > 0) differing++;
      largest = Math.max(largest, difference);
    }
  }
  const total = stored.reduce((sum, { colors }) => sum + colors.width * BYTES_PER_PIXEL, 0);
  return differing === 0
    ? '✓ The browser reads the same strips'
    : `✗ ${differing} of ${total} bytes differ in the browser, by up to ${largest}`;
}
