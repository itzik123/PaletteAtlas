// Rebuilds the gallery's search index (see GALLERY_FILES.searchIndex) from its own files in
// app/public/data, reading no image again. pnpm paintings writes it too, from what it reads.
// Usage: node src/search-index.ts [gallery folder]

import { join } from 'node:path';
import { buildSearchIndex } from './search-data.ts';

const root = join(import.meta.dirname, '../../..');
const [folder = join(root, 'app/public/data')] = process.argv.slice(2);

const started = performance.now();
const { paintings, bytes } = await buildSearchIndex(folder);
const seconds = (performance.now() - started) / 1000;
console.log(
  `Wrote the search index of ${paintings.toLocaleString('en')} paintings to ${folder} ` +
    `(${(bytes / 1e6).toFixed(2)} MB) in ${seconds.toFixed(0)} s`,
);
