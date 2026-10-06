import { BYTES_PER_PIXEL, byteToLinear, LinearRgb, type RgbaImage } from '@palette-atlas/color';

/** Numbers per color in linear light: red, green and blue. */
export const CHANNELS = 3;

/**
 * What a painting's mark shows of its color strip.
 *
 * Strategy: the mockup page offers each one for every design.
 */
export interface BarFill {
  readonly name: string;
  /** The colors along the mark from its start (see Direction), in linear light: CHANNELS numbers per color. */
  colors(strip: RgbaImage): Float64Array;
}

/**
 * The color strip as the gallery stores it: the palette along its path, darker end first. (Its
 * colors sorted by lightness looked all but the same: the path mostly runs from dark to light.)
 */
const STRIP: BarFill = {
  name: 'Strip',
  colors: linearColors,
};

/**
 * The painting's mean color, the color it blends into from afar, as in a movie barcode. A strip's
 * segments all stand for as many pixels, so their mean in linear light is the painting's.
 */
const AVERAGE: BarFill = {
  name: 'Average',
  colors(strip) {
    const mean = LinearRgb.average(strip);
    return mean ? Float64Array.of(mean.r, mean.g, mean.b) : new Float64Array(0);
  },
};

/** The fills in the order the page offers them; the first is picked at the start. */
export const BAR_FILLS: readonly BarFill[] = [STRIP, AVERAGE];

/** A strip's colors in linear light, segment by segment. */
function linearColors({ width, data }: RgbaImage): Float64Array {
  const colors = new Float64Array(width * CHANNELS);
  for (let segment = 0; segment < width; segment++) {
    for (let channel = 0; channel < CHANNELS; channel++) {
      colors[segment * CHANNELS + channel] = byteToLinear(data[segment * BYTES_PER_PIXEL + channel]);
    }
  }
  return colors;
}
