import type { RgbaImage } from '@palette-atlas/color';
import type { AxisName } from '@palette-atlas/strip';

// The messages between the strip pool (strip-pool.ts) and its worker threads (strip-worker.ts).
// postMessage copies them by the structured clone algorithm, so they hold plain data only.

/** One axis's strip: its colors, one pixel per segment. */
export interface AxisColors {
  readonly axis: AxisName;
  readonly colors: RgbaImage;
}

/** What a worker reads from an image file. */
export interface ImageReading {
  /** The strip along every axis, in ImageStrips' order. */
  readonly strips: readonly AxisColors[];
  /** See colorfulness(). */
  readonly colorfulness: number;
}

/** A worker's answer: the reading, or why the image couldn't be read. */
export type WorkerAnswer = { readonly reading: ImageReading } | { readonly error: string };
