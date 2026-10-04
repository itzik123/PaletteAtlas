import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { RgbaImage } from '@palette-atlas/color';
import { describe, expect, it } from 'vitest';
import { readImage } from './image-file.ts';
import { drawStrips } from './strip-images.ts';

const BENCHMARK = join(import.meta.dirname, '../../../benchmark');
const REFERENCES = join(BENCHMARK, 'strips');
/** Decoding a 2000 px image and reading it along every axis can take seconds on a slow machine. */
const TIMEOUT_MS = 30_000;

const images = (await readdir(BENCHMARK)).filter((file) => file.endsWith('.webp')).map((file) => file.slice(0, -'.webp'.length));

/** How many bytes of two images' pixels differ. */
function differingBytes(image: RgbaImage, reference: RgbaImage): number {
  let count = 0;
  for (let index = 0; index < image.data.length; index++) {
    if (image.data[index] !== reference.data[index]) count++;
  }
  return count;
}

describe.each(images)('%s', (name) => {
  it(
    'draws the same strips as its references in benchmark/strips, one for every axis',
    async () => {
      const strips = drawStrips(await readImage(join(BENCHMARK, `${name}.webp`)));
      const references = (await readdir(REFERENCES)).filter((file) => file.startsWith(`${name}-`));
      expect(strips.map(({ axis }) => `${name}-${axis}.png`).sort()).toEqual(references.sort());
      for (const { axis, image } of strips) {
        const reference = await readImage(join(REFERENCES, `${name}-${axis}.png`));
        expect([image.width, image.height]).toEqual([reference.width, reference.height]);
        expect(differingBytes(image, reference), `${name}-${axis}`).toBe(0);
      }
    },
    TIMEOUT_MS,
  );
});
