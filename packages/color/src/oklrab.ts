import { byteToLinear } from './linear-rgb.ts';
import { linearToOkLab } from './oklab.ts';
import { toe } from './toe.ts';

/**
 * Writes the OKLrab coordinates of an 8-bit sRGB pixel into out[0..2], allocating nothing.
 * OKLrab (color.js's name) is OKLab with Ottosson's toe-corrected lightness. Palettes are
 * clustered and compared in it, so that near-blacks that look alike sit close together.
 */
export function bytesToOkLrab(red: number, green: number, blue: number, out: Float64Array): void {
  linearToOkLab(byteToLinear(red), byteToLinear(green), byteToLinear(blue), out);
  out[0] = toe(out[0]);
}
