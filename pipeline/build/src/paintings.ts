// Reads the color strip of every painting the fetch step has downloaded, and writes the gallery's
// files (see GALLERY_FILES) to app/public/data, where the app reads them.
// Usage: node src/paintings.ts [catalog folder] [output folder] [paintings per chunk]
// Run it after `python pipeline/fetch/fetch.py images`; it reads whatever is downloaded so far.

import { join } from 'node:path';
import { buildPaintings, CHUNK_SIZE } from './painting-data.ts';
import { StripPool } from './strip-pool.ts';

const root = join(import.meta.dirname, '../../..');
const [catalogFolder = join(root, 'pipeline/data/wikidata'), outputFolder = join(root, 'app/public/data'), chunkSize] = process.argv.slice(2);

const started = performance.now();
const pool = new StripPool();
try {
  const report = await buildPaintings(catalogFolder, outputFolder, pool, { chunkSize: chunkSize ? Number(chunkSize) : CHUNK_SIZE });
  const minutes = (performance.now() - started) / 60_000;
  console.log(
    `Wrote ${report.paintings.toLocaleString('en')} paintings to ${outputFolder} in ${minutes.toFixed(1)} min; ` +
      `left out ${report.colorless} colorless, ${report.failed} unreadable, ${report.unlinkable} unlinkable ` +
      `and ${report.notDownloaded} not yet downloaded`,
  );
} finally {
  await pool.close();
}
