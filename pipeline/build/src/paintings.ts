// Reads the strips of every painting the fetch step has downloaded, and writes them with the
// paintings' details to app/public/data, where the app reads them.
// Usage: node src/paintings.ts [catalog folder] [output folder]
// Run it after `python pipeline/fetch/fetch.py images`; it reads whatever is downloaded so far.

import { join } from 'node:path';
import { buildPaintings } from './painting-data.ts';
import { StripPool } from './strip-pool.ts';

const root = join(import.meta.dirname, '../../..');
const [catalogFolder = join(root, 'pipeline/data/wikidata'), outputFolder = join(root, 'app/public/data')] = process.argv.slice(2);

const started = performance.now();
const pool = new StripPool();
try {
  const report = await buildPaintings(catalogFolder, outputFolder, pool);
  const minutes = (performance.now() - started) / 60_000;
  console.log(
    `Wrote ${report.paintings.toLocaleString('en')} paintings to ${outputFolder} in ${minutes.toFixed(1)} min; ` +
      `left out ${report.colorless} colorless, ${report.failed} unreadable and ${report.notDownloaded} not yet downloaded`,
  );
} finally {
  await pool.close();
}
