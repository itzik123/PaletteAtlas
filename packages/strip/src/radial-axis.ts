import type { RgbaImage } from '@palette-atlas/color';
import { SourceMap } from './source-map.ts';
import type { StripAxis } from './strip-axis.ts';

/** Distances are measured to the middle of each pixel. */
const PIXEL_CENTER = 0.5;

/**
 * Reads an image from its center outward: each segment is a ring of equal width, and the rings
 * reach into the corners, so that every pixel belongs to one.
 */
export class RadialAxis implements StripAxis {
  sourceMap({ width, height }: RgbaImage, segments: number): SourceMap {
    const centerX = width / 2;
    const centerY = height / 2;
    const reach = Math.hypot(centerX, centerY);
    // Rings at least a pixel wide, so that none is empty.
    const count = Math.max(1, Math.min(segments, Math.floor(reach)));
    const map = new Int32Array(width * height);
    for (let y = 0; y < height; y++) {
      const dy = y + PIXEL_CENTER - centerY;
      for (let x = 0; x < width; x++) {
        const dx = x + PIXEL_CENTER - centerX;
        const distance = Math.sqrt(dx * dx + dy * dy);
        map[y * width + x] = Math.min(count - 1, Math.floor((distance / reach) * count));
      }
    }
    return new SourceMap(width, height, count, map);
  }
}
