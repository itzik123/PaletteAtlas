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

/**
 * Encodes an image as a PNG file. An opaque image is stored without its alpha channel, and
 * compressed harder: the gallery's strips take less than half the room.
 */
export async function writePng(path: string, { width, height, data }: RgbaImage, { opaque = false } = {}): Promise<void> {
  const image = sharp(data, { raw: { width, height, channels: BYTES_PER_PIXEL } });
  await (opaque ? image.removeAlpha().png({ compressionLevel: 9, adaptiveFiltering: true }) : image.png()).toFile(path);
}
