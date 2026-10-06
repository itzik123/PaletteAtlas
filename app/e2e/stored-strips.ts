import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ChunkFiles } from '@palette-atlas/gallery';
import type { Locator, Page } from '@playwright/test';
import { FIXTURE_CHUNK_SIZE, FIXTURE_GALLERY } from './fixture-gallery.ts';

/** A canvas's colors, four bytes per pixel. */
export function canvasColors(canvas: Locator): Promise<number[]> {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not available');
    return Array.from(context.getImageData(0, 0, element.width, element.height).data);
  });
}

/**
 * A painting's color strip as the pipeline stored it in the fixture gallery, at its position in
 * the gallery's chunks or the careers', four bytes per segment, decoded by the browser.
 */
export async function storedStrip(page: Page, files: ChunkFiles, position: number): Promise<number[]> {
  const file = join(FIXTURE_GALLERY, files.strips(Math.floor(position / FIXTURE_CHUNK_SIZE)));
  const bytes = (await readFile(file)).toString('base64');
  return page.evaluate(
    async ({ bytes, row }) => {
      const png = new Blob([Uint8Array.from(atob(bytes), (char) => char.charCodeAt(0))], { type: 'image/png' });
      const bitmap = await createImageBitmap(png, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
      if (!context) throw new Error('Canvas 2D is not available');
      context.drawImage(bitmap, 0, 0);
      return Array.from(context.getImageData(0, row, bitmap.width, 1).data);
    },
    { bytes, row: position % FIXTURE_CHUNK_SIZE },
  );
}
