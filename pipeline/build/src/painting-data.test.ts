import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { RgbaImage } from '@palette-atlas/color';
import {
  type ChunkFiles,
  type Columns,
  CommonsImage,
  chunkOf,
  GALLERY_FILES,
  type GalleryManifest,
  type Painting,
  recordAt,
  recordCount,
  SOURCE_WIDTH,
  stripInRow,
} from '@palette-atlas/gallery';
import { ImageStrips } from '@palette-atlas/strip';
import { colorSchemeVector } from '@palette-atlas/vectorize';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCareers } from './career-data.ts';
import { readCatalog } from './catalog.ts';
import { readManifest } from './chunk-files.ts';
import { readImage } from './image-file.ts';
import { type BuildReport, buildPaintings } from './painting-data.ts';
import { buildSearchData, readSearchIndex } from './search-data.ts';
import { StripPool } from './strip-pool.ts';

/**
 * A catalog the fetch step wrote for six paintings from Wikidata: van Eyck's tall Madonna in the
 * Church, Botticelli's Calumny of Apelles, a black-and-white photo of Palamedesz's Guitar Player,
 * Vroom's wide View of the IJ, Aspertini's dark Female Saint, and Prendergast's Annie Sargent
 * Jewett, left undownloaded.
 */
const FIXTURE = join(import.meta.dirname, '../../fixtures/wikidata');
/** Small enough that the four paintings fill two chunks. */
const CHUNK_SIZE = 2;
/** Van Eyck's Madonna, the first in the catalog, held back to third place. */
const HELD_BACK = { ids: ['Q1747569'], position: 2 };
/** Starting worker threads and reading three images can take seconds on a slow machine. */
const TIMEOUT_MS = 30_000;

/** The first `count` paintings stored in chunks, with their strips, read straight from the files. */
async function readStored(folder: string, files: ChunkFiles, count: number): Promise<{ paintings: Painting[]; strips: RgbaImage[] }> {
  const positions = Array.from({ length: count }, (_, position) => chunkOf(position, CHUNK_SIZE));
  const chunks = [...new Set(positions.map(({ chunk }) => chunk))];
  const records = await Promise.all(
    chunks.map(async (chunk) => JSON.parse(await readFile(join(folder, files.paintings(chunk)), 'utf8')) as Columns<Painting>),
  );
  const images = await Promise.all(chunks.map((chunk) => readImage(join(folder, files.strips(chunk)))));
  return {
    paintings: positions.map(({ chunk, row }) => recordAt(records[chunk], row)),
    strips: positions.map(({ chunk, row }) => stripInRow(images[chunk], row)),
  };
}

describe('buildPaintings', () => {
  let output: string;
  let report: BuildReport;
  let manifest: GalleryManifest;
  let paintings: Painting[];

  beforeAll(async () => {
    // A folder that doesn't exist yet, as on a fresh machine: the build makes it.
    output = join(await mkdtemp(join(tmpdir(), 'paintings-')), 'gallery');
    const pool = new StripPool(2);
    try {
      report = await buildPaintings(FIXTURE, output, pool, { chunkSize: CHUNK_SIZE, heldBack: HELD_BACK, log: () => {} });
    } finally {
      await pool.close();
    }
    manifest = await readManifest(output);
    ({ paintings } = await readStored(output, GALLERY_FILES.gallery, manifest.count));
  }, TIMEOUT_MS);

  afterAll(() => rm(dirname(output), { recursive: true, force: true }));

  it('lists the downloaded paintings in color in the order of the catalog, but for those held back, each with its artist', async () => {
    expect(report).toEqual({ paintings: 4, notDownloaded: 1, colorless: 1, failed: 0, unlinkable: 0 });
    expect(manifest.count).toBe(4);
    expect(paintings.map(({ id }) => id)).toEqual(['Q1217187', 'Q17812507', 'Q1747569', 'Q18748372']);
    expect(paintings.map(({ artist }) => recordAt(manifest.artists, artist).name)).toEqual([
      'Sandro Botticelli',
      'Hendrick Cornelisz Vroom',
      'Jan van Eyck',
      'Amico Aspertini',
    ]);
    expect(JSON.parse(await readFile(join(output, GALLERY_FILES.ids), 'utf8'))).toEqual(paintings.map(({ id }) => id));
  });

  it('links every painting to the very image on Commons that its strip was read from', async () => {
    const { works } = await readCatalog(join(FIXTURE, 'works.json'));
    for (const painting of paintings) {
      const image = new CommonsImage(painting.file, painting.hash, painting.width);
      expect(image.url(SOURCE_WIDTH)).toBe(works.find(({ id }) => id === painting.id)?.thumbnail);
    }
  });

  it(
    'stores every painting’s color strip exactly as ImageStrips reads its image',
    async () => {
      for (const [position, painting] of paintings.entries()) {
        const { strips } = ImageStrips.read(await readImage(join(FIXTURE, 'images', `${painting.id}.jpg`)));
        const expected = strips.find(({ axis }) => axis === 'color')?.strip.toImage();
        const { chunk, row } = chunkOf(position, manifest.chunkSize);
        const stored = stripInRow(await readImage(join(output, GALLERY_FILES.gallery.strips(chunk))), row);
        expect(stored.width).toBe(manifest.segments);
        expect(Buffer.from(stored.data).equals(Buffer.from(expected?.data ?? [])), painting.id).toBe(true);
      }
    },
    TIMEOUT_MS,
  );

  it('writes every artist’s career: their dated paintings in the order they made them, artist after artist, with their strips', async () => {
    const lengths = JSON.parse(await readFile(join(output, GALLERY_FILES.careerLengths), 'utf8')) as number[];
    // Each artist has one painting here, dated closely enough to place.
    expect(lengths).toEqual([1, 1, 1, 1]);
    expect(recordCount(manifest.artists)).toBe(lengths.length);
    const gallery = await readStored(output, GALLERY_FILES.gallery, manifest.count);
    const career = await readStored(output, GALLERY_FILES.careers, 4);
    expect(career.paintings.map(({ artist }) => artist)).toEqual([0, 1, 2, 3]);
    for (const [index, painting] of career.paintings.entries()) {
      const position = paintings.findIndex(({ id }) => id === painting.id);
      expect(painting).toEqual(paintings[position]);
      expect(Buffer.from(career.strips[index].data).equals(Buffer.from(gallery.strips[position].data)), painting.id).toBe(true);
    }
  });

  it('rebuilds the very same careers from the gallery’s own files, reading no image again', async () => {
    const files = [GALLERY_FILES.careerLengths, ...[0, 1].flatMap((chunk) => [GALLERY_FILES.careers.paintings(chunk), GALLERY_FILES.careers.strips(chunk)])];
    const written = await Promise.all(files.map((file) => readFile(join(output, file))));
    await Promise.all([GALLERY_FILES.careerLengths, ...GALLERY_FILES.careers.folders].map((name) => rm(join(output, name), { recursive: true })));
    expect(await buildCareers(output)).toEqual({ artists: 4, paintings: 4 });
    for (const [index, file] of files.entries()) expect((await readFile(join(output, file))).equals(written[index]), file).toBe(true);
  });

  it('writes a search index of every painting, in which each finds itself by its own strip', async () => {
    const index = await readSearchIndex(output);
    expect(index.graph.count).toBe(manifest.count);
    const { strips } = await readStored(output, GALLERY_FILES.gallery, manifest.count);
    expect(strips.map((strip) => index.search(colorSchemeVector(strip), 1)[0].id)).toEqual(strips.map((_, position) => position));
  });

  it('rebuilds the very same search index and map from the gallery’s own files, reading no image again', async () => {
    const files = [GALLERY_FILES.searchIndex, GALLERY_FILES.paintingMap];
    const written = await Promise.all(files.map((file) => readFile(join(output, file))));
    await Promise.all(files.map((file) => rm(join(output, file))));
    const report = await buildSearchData(output);
    expect([report.paintings, report.indexBytes, report.map.bytes]).toEqual([4, written[0].length, written[1].length]);
    for (const [index, file] of files.entries()) expect((await readFile(join(output, file))).equals(written[index]), file).toBe(true);
  });
});
