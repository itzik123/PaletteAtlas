import { BYTES_PER_PIXEL, type RgbaImage } from '@palette-atlas/color';
import { type AxisName, ImageStrips } from '@palette-atlas/strip';

/** Each segment is drawn as a band this many pixels wide. */
const BAND_WIDTH = 8;
/** The height of a drawn strip. */
const STRIP_HEIGHT = 128;

export interface StripImage {
  /** The axis the strip reads along, as it appears in file names. */
  readonly axis: AxisName;
  /** The strip drawn as an image, every segment a vertical band. */
  readonly image: RgbaImage;
}

/** An image's strips along every axis, read with the project's settings (see ImageStrips) and drawn as images. */
export function drawStrips(image: RgbaImage): StripImage[] {
  return ImageStrips.read(image).strips.map(({ axis, strip }) => ({ axis, image: bands(strip.toImage()) }));
}

/** A strip image, one pixel per segment, drawn with every segment as a BAND_WIDTH × STRIP_HEIGHT band. */
function bands(strip: RgbaImage): RgbaImage {
  const width = strip.width * BAND_WIDTH;
  const row = new Uint8ClampedArray(width * BYTES_PER_PIXEL);
  for (let x = 0; x < width; x++) {
    const segment = Math.floor(x / BAND_WIDTH) * BYTES_PER_PIXEL;
    row.set(strip.data.subarray(segment, segment + BYTES_PER_PIXEL), x * BYTES_PER_PIXEL);
  }
  const data = new Uint8ClampedArray(row.length * STRIP_HEIGHT);
  for (let y = 0; y < STRIP_HEIGHT; y++) data.set(row, y * row.length);
  return { width, height: STRIP_HEIGHT, data };
}
