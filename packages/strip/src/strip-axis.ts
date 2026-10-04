import type { RgbaImage } from '@palette-atlas/color';
import type { SourceMap } from './source-map.ts';

/**
 * A way to read an image as a strip: it decides which segment each pixel belongs to, and so
 * the strip's order. Strategy: every axis implements this one interface, so a new axis is a
 * new class with no edits elsewhere.
 */
export interface StripAxis {
  /** Splits the image's pixels into at most `segments` segments, numbered along the strip. */
  sourceMap(image: RgbaImage, segments: number): SourceMap;
}
