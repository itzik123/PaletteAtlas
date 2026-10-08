// Rebuilds the gallery's search index and the map the Lab draws it on (see GALLERY_FILES.searchIndex
// and paintingMap) from its own files in app/public/data, reading no image again. pnpm paintings
// writes them too, from what it reads.
// Usage: node src/search-index.ts [gallery folder]

import { join } from 'node:path';
import { buildSearchData } from './search-data.ts';

const root = join(import.meta.dirname, '../../..');
const [folder = join(root, 'app/public/data')] = process.argv.slice(2);

const started = performance.now();
const { paintings, indexBytes, map } = await buildSearchData(folder);
const seconds = (performance.now() - started) / 1000;
console.log(
  `Wrote the search index of ${paintings.toLocaleString('en')} paintings to ${folder} ` +
    `(${(indexBytes / 1e6).toFixed(2)} MB) and their map (${(map.bytes / 1e6).toFixed(2)} MB, ` +
    `holding ${(100 * map.held).toFixed(1)}% of the variance) in ${seconds.toFixed(0)} s`,
);
