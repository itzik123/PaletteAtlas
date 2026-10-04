import type { PaletteColor } from '@palette-atlas/color';
import { Swatch } from './paint.ts';

const PERCENT = 100;
/** Decimal places in each color's share. */
const SHARE_DIGITS = 1;

/** A palette as a bar with one segment per color, as wide as its share, above the colors themselves. */
export function paletteView(palette: readonly PaletteColor[]): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'palette-bar';
  for (const { color, share } of palette) {
    const segment = document.createElement('div');
    segment.style.background = color.toSrgb().toHex();
    segment.style.flexGrow = String(share);
    bar.append(segment);
  }
  const swatches = document.createElement('div');
  swatches.className = 'swatches palette';
  swatches.append(
    ...palette.map(({ color, share }) => new Swatch(`${(share * PERCENT).toFixed(SHARE_DIGITS)}%`, color.toSrgb()).element),
  );
  const element = document.createElement('div');
  element.append(bar, swatches);
  return element;
}
