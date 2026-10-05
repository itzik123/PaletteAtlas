import type { RgbaImage } from '@palette-atlas/color';
import { decodeImage } from '../image-adapters.ts';

/** Fetches an image file and returns its pixels. */
export async function loadImage(url: string): Promise<RgbaImage> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
  return decodeImage(await response.blob());
}
