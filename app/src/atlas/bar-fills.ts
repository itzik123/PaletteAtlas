import { BYTES_PER_PIXEL, Channel, LinearRgb, MAX_BYTE, type RgbaImage } from '@palette-atlas/color';
import { AVERAGE_FILL_ICON, STRIP_FILL_ICON } from '../icons.ts';

/**
 * What each bar of a career barcode shows of its painting.
 *
 * Strategy: the artist page switches between them (see CareerView).
 */
export interface BarFill {
  /** What the switch calls it. */
  readonly label: string;
  readonly icon: string;
  /**
   * The barcode at one pixel per painting across, from paintings' color strips in order: each
   * painting's colors in a column, from the bottom up. The view resizes it to the screen.
   */
  barcode(strips: readonly RgbaImage[]): RgbaImage;
}

/**
 * Each painting's color strip, turned on end: its palette along its path from the darker end at
 * the bottom, each color as tall as its share of the painting.
 */
export const STRIP_FILL: BarFill = {
  label: 'Strip',
  icon: STRIP_FILL_ICON,
  barcode(strips) {
    const height = strips[0]?.width ?? 0;
    const data = new Uint8ClampedArray(strips.length * height * BYTES_PER_PIXEL);
    strips.forEach((strip, column) => {
      for (let segment = 0; segment < height; segment++) {
        const from = segment * BYTES_PER_PIXEL;
        data.set(strip.data.subarray(from, from + BYTES_PER_PIXEL), ((height - 1 - segment) * strips.length + column) * BYTES_PER_PIXEL);
      }
    });
    return { width: strips.length, height, data };
  },
};

/**
 * Each painting's average color, the color it blends into from afar, as in a movie barcode. A
 * strip's segments all stand for as many pixels, so their mean in linear light is the painting's.
 */
export const AVERAGE_FILL: BarFill = {
  label: 'Average',
  icon: AVERAGE_FILL_ICON,
  barcode(strips) {
    const data = new Uint8ClampedArray(strips.length * BYTES_PER_PIXEL);
    strips.forEach((strip, column) => {
      const mean = LinearRgb.average(strip)?.toSrgb().toBytes() ?? [0, 0, 0];
      data.set([...mean, MAX_BYTE], column * BYTES_PER_PIXEL + Channel.red);
    });
    return { width: strips.length, height: 1, data };
  },
};

/** The fills in the order the switch offers them; the first is shown at the start. */
export const BAR_FILLS: readonly BarFill[] = [STRIP_FILL, AVERAGE_FILL];
