import type { Strip } from '@palette-atlas/strip';
import { imageCanvas } from '../image-adapters.ts';

/**
 * One axis's strip beside its fold-back. Observer: hovering the strip reports the segment
 * under the pointer, and leaving it reports undefined.
 */
export class StripRow {
  readonly element = document.createElement('div');

  constructor(name: string, strip: Strip, onHover: (segment: number | undefined) => void) {
    const label = document.createElement('span');
    label.textContent = name;
    const band = imageCanvas(strip.toImage());
    band.className = 'strip';
    band.addEventListener('mousemove', (event) => {
      const fraction = event.offsetX / band.clientWidth;
      onHover(Math.min(strip.segmentCount - 1, Math.max(0, Math.floor(fraction * strip.segmentCount))));
    });
    band.addEventListener('mouseleave', () => onHover(undefined));
    const foldBack = imageCanvas(strip.foldBack());
    foldBack.className = 'fold-back';
    foldBack.title = 'Fold-back: each segment painted over its pixels';
    this.element.className = 'strip-row';
    this.element.append(label, band, foldBack);
  }
}
