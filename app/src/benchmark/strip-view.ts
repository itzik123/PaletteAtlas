import { BYTES_PER_PIXEL, Channel } from '@palette-atlas/color';
import type { SourceMap, Strip } from '@palette-atlas/strip';
import { context2d, imageCanvas } from '../image-adapters.ts';

/** How dark the veil over pixels outside the hovered segment is, out of 255. */
const VEIL_ALPHA = 176;

/**
 * A veil over an image that leaves one strip segment's pixels uncovered, drawn from the strip's
 * source map, so hovering a strip shows where each of its segments came from.
 */
export class SourceHighlight {
  readonly element = document.createElement('canvas');

  constructor() {
    this.element.className = 'highlight';
  }

  show(map: SourceMap, segment: number): void {
    const { width, height } = map;
    this.element.width = width;
    this.element.height = height;
    const context = context2d(this.element);
    const veil = context.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (map.segmentAt(x, y) !== segment) veil.data[(y * width + x) * BYTES_PER_PIXEL + Channel.alpha] = VEIL_ALPHA;
      }
    }
    context.putImageData(veil, 0, 0);
  }

  clear(): void {
    context2d(this.element).clearRect(0, 0, this.element.width, this.element.height);
  }
}

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
