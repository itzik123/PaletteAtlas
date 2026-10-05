import type { RgbaImage } from '@palette-atlas/color';

// Adapters (ports and adapters) between the browser's images and the libraries' RgbaImage: canvas
// ImageData already has its shape, so pixels pass straight through in both directions.

/**
 * Decodes an image file with the browser and returns its pixels, turned upright by its EXIF
 * orientation. createImageBitmap decodes off the main thread, even in a hidden tab (where
 * HTMLImageElement.decode() never settles).
 */
export async function decodeImage(file: Blob): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is not available');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

/** Paints an image onto a canvas, resized to the image's own size. */
export function paintImage(canvas: HTMLCanvasElement, image: RgbaImage): void {
  canvas.width = image.width;
  canvas.height = image.height;
  context2d(canvas).putImageData(toImageData(image), 0, 0);
}

/** A canvas showing an image at its own size. */
export function imageCanvas(image: RgbaImage): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  paintImage(canvas, image);
  return canvas;
}

export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is not available');
  return context;
}

/** An RgbaImage as ImageData, copied unless it already is one. */
function toImageData(image: RgbaImage): ImageData {
  if (image instanceof ImageData) return image;
  return new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
}
