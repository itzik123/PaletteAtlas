import {
  downscale,
  extractPalette,
  KMeans,
  PALETTE_WORKING_SIZE,
  type PaletteColor,
  type RgbaImage,
  SeededRandom,
} from '@palette-atlas/color';
import { ColorAxis } from './color-axis.ts';
import { ColumnAxis } from './column-axis.ts';
import { HilbertAxis } from './hilbert-axis.ts';
import { RadialAxis } from './radial-axis.ts';
import { Strip } from './strip.ts';
import type { StripAxis } from './strip-axis.ts';

/** Segments in every strip. */
export const STRIP_SEGMENTS = 128;
/** Colors in the palette the color axis reads by. */
export const PALETTE_SIZE = 8;
/** A fixed seed, so that an image always gets the same palette, and with it the same color strip. */
const PALETTE_SEED = 1;

/** The axes, by the names the app and the pipeline's files know them by. */
export type AxisName = 'columns' | 'radial' | 'hilbert' | 'color';

export interface NamedStrip {
  readonly axis: AxisName;
  readonly strip: Strip;
}

/**
 * An image read along every axis with the project's settings, so that the app and the pipeline
 * draw the same strips: shrunk to PALETTE_WORKING_SIZE by area averaging in linear light, its
 * palette found by k-means, and one strip of STRIP_SEGMENTS segments per axis, the color axis
 * reading by that palette.
 *
 * Facade: one call stands in for the color library's shrink and palette and the strip engine.
 */
export class ImageStrips {
  /** The image as the strips read it. Their source maps index its pixels. */
  readonly shrunk: RgbaImage;
  /** The image's main colors, largest share first. */
  readonly palette: readonly PaletteColor[];
  /** One strip per axis, in a fixed order. */
  readonly strips: readonly NamedStrip[];

  private constructor(shrunk: RgbaImage, palette: readonly PaletteColor[], strips: readonly NamedStrip[]) {
    this.shrunk = shrunk;
    this.palette = palette;
    this.strips = strips;
  }

  static read(image: RgbaImage): ImageStrips {
    const shrunk = downscale(image, PALETTE_WORKING_SIZE);
    const palette = extractPalette(shrunk, new KMeans(PALETTE_SIZE, new SeededRandom(PALETTE_SEED)));
    const axes: readonly (readonly [AxisName, StripAxis])[] = [
      ['columns', new ColumnAxis()],
      ['radial', new RadialAxis()],
      ['hilbert', new HilbertAxis()],
      ['color', new ColorAxis(() => palette)],
    ];
    const strips = axes.map(([axis, stripAxis]) => ({ axis, strip: Strip.read(shrunk, stripAxis, STRIP_SEGMENTS) }));
    return new ImageStrips(shrunk, palette, strips);
  }
}
