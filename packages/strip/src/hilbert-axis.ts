import type { RgbaImage } from '@palette-atlas/color';
import { hilbertCurve } from './hilbert-curve.ts';
import { SourceMap } from './source-map.ts';
import type { StripAxis } from './strip-axis.ts';

/**
 * Reads an image through space: along a Hilbert curve from its top-left corner, cut into runs of
 * equal length. Each segment is a compact patch of the image, and neighboring segments are
 * neighboring patches.
 */
export class HilbertAxis implements StripAxis {
  sourceMap({ width, height }: RgbaImage, segments: number): SourceMap {
    return SourceMap.fromSequence(width, height, hilbertCurve(width, height), segments);
  }
}
