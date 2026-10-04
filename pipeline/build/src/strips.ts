// Writes the strips of every image in a folder as PNG files, one per axis, named <image>-<axis>.png.
// Usage: node src/strips.ts [input folder] [output folder]
// The defaults read the benchmark images and write benchmark/strips, the references the tests
// compare against; rerun it after an intended change to the strips and review the new files.

import { mkdir, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { readImage, writePng } from './image-file.ts';
import { drawStrips } from './strip-images.ts';

/** File types the script reads: the benchmark's renders, and the PNGs the fetch step writes. */
const IMAGE_EXTENSIONS = new Set(['.png', '.webp']);

const [input = join(import.meta.dirname, '../../../benchmark'), output = join(input, 'strips')] = process.argv.slice(2);

await mkdir(output, { recursive: true });
const files = (await readdir(input)).filter((file) => IMAGE_EXTENSIONS.has(extname(file).toLowerCase())).sort();
for (const file of files) {
  const name = file.slice(0, -extname(file).length);
  for (const { axis, image } of drawStrips(await readImage(join(input, file)))) {
    const path = join(output, `${name}-${axis}.png`);
    await writePng(path, image);
    console.log(`Wrote ${relative(process.cwd(), path)}`);
  }
}
