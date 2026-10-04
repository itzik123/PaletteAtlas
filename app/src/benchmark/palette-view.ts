import { type PaletteColor, PalettePath } from '@palette-atlas/color';
import { Swatch } from './paint.ts';

const PERCENT = 100;
/** Decimal places in each color's share. */
const SHARE_DIGITS = 1;

/**
 * A palette as two bars with one segment per color, as wide as its share: largest share first,
 * and along the shortest path through the colors, the order the color axis reads them in. The
 * colors themselves are underneath, largest share first.
 */
export function paletteView(palette: readonly PaletteColor[]): HTMLElement {
  const swatches = document.createElement('div');
  swatches.className = 'swatches palette';
  swatches.append(
    ...palette.map(({ color, share }) => new Swatch(`${(share * PERCENT).toFixed(SHARE_DIGITS)}%`, color.toSrgb()).element),
  );
  const element = document.createElement('div');
  element.append(
    paletteBar('Largest first', palette),
    paletteBar('Shortest path', new PalettePath(palette).colors),
    swatches,
  );
  return element;
}

function paletteBar(name: string, colors: readonly PaletteColor[]): HTMLElement {
  const label = document.createElement('span');
  label.textContent = name;
  const bar = document.createElement('div');
  bar.className = 'palette-bar';
  for (const { color, share } of colors) {
    const segment = document.createElement('div');
    segment.style.background = color.toSrgb().toHex();
    segment.style.flexGrow = String(share);
    bar.append(segment);
  }
  const row = document.createElement('div');
  row.className = 'palette-row';
  row.append(label, bar);
  return row;
}
