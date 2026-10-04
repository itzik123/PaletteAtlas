import type { RgbaImage } from '@palette-atlas/color';
import { SourceMap } from './source-map.ts';
import type { StripAxis } from './strip-axis.ts';

/** Reads an image from left to right: each segment is a vertical band of nearly equal width. */
export class ColumnAxis implements StripAxis {
  sourceMap({ width, height }: RgbaImage, segments: number): SourceMap {
    // At most one band per pixel column, so that none is empty.
    const count = Math.max(1, Math.min(segments, width));
    const bandOfColumn = Int32Array.from({ length: width }, (_, x) => Math.floor((x * count) / width));
    const map = new Int32Array(width * height);
    for (let y = 0; y < height; y++) map.set(bandOfColumn, y * width);
    return new SourceMap(width, height, count, map);
  }
}
