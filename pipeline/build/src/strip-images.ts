import {
  BYTES_PER_PIXEL,
  downscale,
  extractPalette,
  KMeans,
  PALETTE_WORKING_SIZE,
  type RgbaImage,
  SeededRandom,
} from '@palette-atlas/color';
import { ColorAxis, ColumnAxis, HilbertAxis, RadialAxis, Strip, type StripAxis } from '@palette-atlas/strip';

// The benchmark page's settings, so that its strips and these can be compared.
/** Segments in each strip. */
const SEGMENTS = 128;
/** Colors in the palette the color axis reads by. */
const PALETTE_SIZE = 8;
/** A fixed seed, so that the palette, and with it the color strip, is the same on every run. */
const PALETTE_SEED = 1;

/** Each segment is drawn as a band this many pixels wide. */
const BAND_WIDTH = 8;
/** The height of a drawn strip. */
const STRIP_HEIGHT = 128;

export interface StripImage {
  /** The axis the strip reads along, as it appears in file names. */
  readonly axis: string;
  /** The strip drawn as an image, every segment a vertical band. */
  readonly image: RgbaImage;
}

/**
 * An image's strips along every axis, drawn as images. The image is shrunk to
 * PALETTE_WORKING_SIZE by area averaging in linear light first, as on the benchmark page.
 */
export function drawStrips(image: RgbaImage): StripImage[] {
  const shrunk = downscale(image, PALETTE_WORKING_SIZE);
  const palette = extractPalette(shrunk, new KMeans(PALETTE_SIZE, new SeededRandom(PALETTE_SEED)));
  const axes: readonly (readonly [name: string, axis: StripAxis])[] = [
    ['columns', new ColumnAxis()],
    ['radial', new RadialAxis()],
    ['hilbert', new HilbertAxis()],
    ['color', new ColorAxis(() => palette)],
  ];
  return axes.map(([name, axis]) => ({ axis: name, image: bands(Strip.read(shrunk, axis, SEGMENTS).toImage()) }));
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
