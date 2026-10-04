import type { RgbaImage } from '@palette-atlas/color';

/**
 * Decodes an image file with the browser and returns its pixels. createImageBitmap decodes off
 * the main thread, even in a hidden tab (where HTMLImageElement.decode() never settles).
 *
 * Adapter (ports and adapters): canvas ImageData already has the shape of the libraries'
 * RgbaImage, so its pixels pass straight through.
 */
export async function loadImage(url: string): Promise<RgbaImage> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is not available');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
