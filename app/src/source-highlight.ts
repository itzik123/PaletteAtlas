import { BYTES_PER_PIXEL, Channel, MAX_BYTE, type Srgb } from '@palette-atlas/color';
import type { SourceMap } from '@palette-atlas/strip';
import { context2d } from './image-adapters.ts';

/**
 * A veil over an image that leaves one strip segment's pixels uncovered, drawn from the strip's
 * source map at the map's own size and stretched over the image, so it shows where the segment
 * came from.
 */
export class SourceHighlight {
  readonly element = document.createElement('canvas');
  /** How opaque the veil is, from 0 to MAX_BYTE. */
  readonly #alpha: number;

  /** @param opacity How much of the image the veil hides, from 0 to 1. */
  constructor(opacity: number) {
    this.#alpha = Math.round(opacity * MAX_BYTE);
  }

  /** Veils every pixel outside the segment in the given color. */
  show(map: SourceMap, segment: number, veil: Srgb): void {
    const { width, height } = map;
    this.element.width = width;
    this.element.height = height;
    const context = context2d(this.element);
    const pixels = context.createImageData(width, height);
    const [red, green, blue] = veil.toBytes();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (map.segmentAt(x, y) === segment) continue;
        const pixel = (y * width + x) * BYTES_PER_PIXEL;
        pixels.data[pixel + Channel.red] = red;
        pixels.data[pixel + Channel.green] = green;
        pixels.data[pixel + Channel.blue] = blue;
        pixels.data[pixel + Channel.alpha] = this.#alpha;
      }
    }
    context.putImageData(pixels, 0, 0);
  }

  clear(): void {
    context2d(this.element).clearRect(0, 0, this.element.width, this.element.height);
  }
}
