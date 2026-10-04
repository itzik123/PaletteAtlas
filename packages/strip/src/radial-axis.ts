import type { RgbaImage } from '@palette-atlas/color';
import { SourceMap } from './source-map.ts';
import type { StripAxis } from './strip-axis.ts';

/** Distances are measured to the middle of each pixel. */
const PIXEL_CENTER = 0.5;

/**
 * Reads an image from its center outward: its pixels in order of their distance from the center,
 * cut into runs of equal length. Each segment is a ring holding an equal share of the pixels, like
 * the segments of every other axis, so the rings grow thinner away from the center, and reach
 * into the corners.
 */
export class RadialAxis implements StripAxis {
  sourceMap({ width, height }: RgbaImage, segments: number): SourceMap {
    const centerX = width / 2;
    const centerY = height / 2;
    // Squared distances, which order the pixels the same way without a square root.
    const distances = new Float64Array(width * height);
    for (let y = 0; y < height; y++) {
      const dy = y + PIXEL_CENTER - centerY;
      for (let x = 0; x < width; x++) {
        const dx = x + PIXEL_CENTER - centerX;
        distances[y * width + x] = dx * dx + dy * dy;
      }
    }
    // Pixels at the same distance keep their reading order.
    const outward = Uint32Array.from(distances.keys()).sort((a, b) => distances[a] - distances[b] || a - b);
    return SourceMap.fromSequence(width, height, outward, segments);
  }
}
