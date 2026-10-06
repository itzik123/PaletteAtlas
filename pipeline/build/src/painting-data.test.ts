import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
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
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readCatalog } from './catalog.ts';
import { readImage } from './image-file.ts';
import { type BuildReport, buildPaintings } from './painting-data.ts';
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

describe('buildPaintings', () => {
  let output: string;
  let report: BuildReport;
  let manifest: GalleryManifest;
  let paintings: Painting[];

  beforeAll(async () => {
    output = await mkdtemp(join(tmpdir(), 'paintings-'));
    const pool = new StripPool(2);
    try {
      report = await buildPaintings(FIXTURE, output, pool, { chunkSize: CHUNK_SIZE, heldBack: HELD_BACK, log: () => {} });
    } finally {
      await pool.close();
    }
    const read = async <T>(file: string): Promise<T> => JSON.parse(await readFile(join(output, file), 'utf8')) as T;
    manifest = await read(GALLERY_FILES.manifest);
    const chunks = await Promise.all([0, 1].map((chunk) => read<Columns<Painting>>(GALLERY_FILES.paintings(chunk))));
    paintings = chunks.flatMap((columns) => Array.from({ length: recordCount(columns) }, (_, row) => recordAt(columns, row)));
  }, TIMEOUT_MS);

  afterAll(() => rm(output, { recursive: true, force: true }));

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
        const stored = stripInRow(await readImage(join(output, GALLERY_FILES.strips(chunk))), row);
        expect(stored.width).toBe(manifest.segments);
        expect(Buffer.from(stored.data).equals(Buffer.from(expected?.data ?? [])), painting.id).toBe(true);
      }
    },
    TIMEOUT_MS,
  );
});
