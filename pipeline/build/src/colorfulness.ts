import type { PaletteColor } from '@palette-atlas/color';

/**
 * How colorful an image is: the OKLab chroma of its palette colors, averaged by their shares. A
 * black-and-white photo scores about 0; JPEG noise alone stays far below MIN_COLORFULNESS.
 */
export function colorfulness(palette: readonly PaletteColor[]): number {
  return palette.reduce((sum, { color, share }) => sum + Math.hypot(color.a, color.b) * share, 0);
}
