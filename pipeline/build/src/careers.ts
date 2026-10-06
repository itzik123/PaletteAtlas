// Rebuilds the artists' careers (see GALLERY_FILES.careers) from the gallery's own files in
// app/public/data, reading no image again. pnpm paintings writes them too, from what it reads.
// Usage: node src/careers.ts [gallery folder]

import { join } from 'node:path';
import { buildCareers } from './career-data.ts';

const root = join(import.meta.dirname, '../../..');
const [folder = join(root, 'app/public/data')] = process.argv.slice(2);

const { artists, paintings } = await buildCareers(folder);
console.log(`Wrote the careers of ${artists.toLocaleString('en')} artists, ${paintings.toLocaleString('en')} paintings in all, to ${folder}`);
