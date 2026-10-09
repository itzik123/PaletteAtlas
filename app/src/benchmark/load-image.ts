import type { RgbaImage } from '@palette-atlas/color';
import { fetchOk } from '../fetching.ts';
import { decodeImage } from '../image-adapters.ts';

/** Fetches an image file and returns its pixels. */
export async function loadImage(url: string): Promise<RgbaImage> {
  return decodeImage(await (await fetchOk(url)).blob());
}
