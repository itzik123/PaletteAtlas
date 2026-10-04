import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BYTES_PER_PIXEL,
  Channel,
  MAX_BYTE,
  OkLab,
  PALETTE_COVERAGE,
  type PaletteColor,
  type RgbaImage,
  Srgb,
  toe,
} from '@palette-atlas/color';
import { ImageStrips } from '@palette-atlas/strip';
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

/** The share of an image's visible pixels farther from every palette color than the coverage distance, in OKLrab. */
function uncoveredShare({ data }: RgbaImage, palette: readonly PaletteColor[]): number {
  const stops = palette.map(({ color }) => [toe(color.l), color.a, color.b]);
  let uncovered = 0;
  let visible = 0;
  for (let offset = 0; offset < data.length; offset += BYTES_PER_PIXEL) {
    const weight = data[offset + Channel.alpha] / MAX_BYTE;
    const pixel = OkLab.fromSrgb(Srgb.fromBytes(data[offset + Channel.red], data[offset + Channel.green], data[offset + Channel.blue]));
    const nearest = Math.min(...stops.map(([l, a, b]) => Math.hypot(toe(pixel.l) - l, pixel.a - a, pixel.b - b)));
    if (nearest > PALETTE_COVERAGE.distance) uncovered += weight;
    visible += weight;
  }
  return uncovered / visible;
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

  // Pixels with no palette color near them land inside the stretch of whichever color is nearest,
  // and show there as a band of a color unlike the rest of it.
  it(
    'finds a palette color near every sizeable group of pixels, so the color strip has no foreign bands',
    async () => {
      const { shrunk, palette } = ImageStrips.read(await readImage(join(BENCHMARK, `${name}.webp`)));
      expect(uncoveredShare(shrunk, palette)).toBeLessThanOrEqual(PALETTE_COVERAGE.uncoveredShare);
    },
    TIMEOUT_MS,
  );
});
