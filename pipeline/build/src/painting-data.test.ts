import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BYTES_PER_PIXEL } from '@palette-atlas/color';
import { ImageStrips } from '@palette-atlas/strip';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readImage } from './image-file.ts';
import { buildPaintings, PAINTINGS_FILE, type PaintingsFile, STRIPS_FOLDER } from './painting-data.ts';
import { StripPool } from './strip-pool.ts';

/**
 * A catalog the fetch step wrote for six paintings from Wikidata: van Eyck's tall Madonna in the
 * Church, Botticelli's Calumny of Apelles, a black-and-white photo of Palamedesz's Guitar Player,
 * Vroom's wide View of the IJ, Aspertini's dark Female Saint, and Prendergast's Annie Sargent
 * Jewett, left undownloaded.
 */
const FIXTURE = join(import.meta.dirname, '../../fixtures/wikidata');
/** Small enough that the four paintings fill two atlas chunks. */
const CHUNK_SIZE = 2;
/** Starting worker threads and reading three images can take seconds on a slow machine. */
const TIMEOUT_MS = 30_000;

describe('buildPaintings', () => {
  let output: string;
  let built: PaintingsFile;

  beforeAll(async () => {
    output = await mkdtemp(join(tmpdir(), 'paintings-'));
    const pool = new StripPool(2);
    try {
      await buildPaintings(FIXTURE, output, pool, { chunkSize: CHUNK_SIZE, log: () => {} });
    } finally {
      await pool.close();
    }
    built = JSON.parse(await readFile(join(output, PAINTINGS_FILE), 'utf8')) as PaintingsFile;
  }, TIMEOUT_MS);

  afterAll(() => rm(output, { recursive: true, force: true }));

  it('lists the downloaded paintings in color, in the order of the catalog, each with its artist', () => {
    expect(built.paintings.map(({ id }) => id)).toEqual(['Q1747569', 'Q1217187', 'Q17812507', 'Q18748372']);
    expect(built.paintings.map(({ artist }) => built.artists[artist].name)).toEqual([
      'Jan van Eyck',
      'Sandro Botticelli',
      'Hendrick Cornelisz Vroom',
      'Amico Aspertini',
    ]);
  });

  it('notes the strips shorter than the rest: a tall painting has fewer columns than segments', () => {
    expect(built.paintings.map(({ lengths }) => lengths)).toEqual([{ columns: 114 }, undefined, undefined, undefined]);
  });

  it(
    'stores every painting’s strip along every axis exactly as ImageStrips reads its image, then transparent pixels',
    async () => {
      const rowBytes = built.segments * BYTES_PER_PIXEL;
      for (const [index, painting] of built.paintings.entries()) {
        const { strips } = ImageStrips.read(await readImage(join(FIXTURE, 'images', `${painting.id}.jpg`)));
        expect(strips.map(({ axis }) => axis)).toEqual(built.axes);
        for (const { axis, strip } of strips) {
          const chunk = await readImage(join(output, STRIPS_FOLDER, `${axis}-${Math.floor(index / built.chunkSize)}.png`));
          const row = (index % built.chunkSize) * rowBytes;
          const stored = Buffer.from(chunk.data.subarray(row, row + rowBytes));
          const expected = Buffer.from(strip.toImage().data);
          expect(stored.subarray(0, expected.length).equals(expected), `${painting.id} along ${axis}`).toBe(true);
          expect(stored.subarray(expected.length).every((byte) => byte === 0), `${painting.id}'s padding along ${axis}`).toBe(true);
        }
      }
    },
    TIMEOUT_MS,
  );
});
