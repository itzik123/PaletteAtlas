import { BYTES_PER_PIXEL, type RgbaImage } from '@palette-atlas/color';
import sharp from 'sharp';

/**
 * Decodes an image file (PNG, WebP or JPEG) into 8-bit sRGB pixels with alpha, turned upright by
 * its EXIF orientation as browsers do.
 *
 * Adapter (ports and adapters): sharp's raw output already has the shape of the libraries'
 * RgbaImage, so the decoded pixels pass straight through.
 */
export async function readImage(path: string): Promise<RgbaImage> {
  const { data, info } = await sharp(path).autoOrient().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

/** Encodes an image as a PNG file. */
export async function writePng(path: string, { width, height, data }: RgbaImage): Promise<void> {
  await sharp(data, { raw: { width, height, channels: BYTES_PER_PIXEL } }).png().toFile(path);
}
