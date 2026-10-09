import type { RgbaImage } from '@palette-atlas/color';
import type { AxisName } from '@palette-atlas/strip';

// The messages between the strip pool (strip-pool.ts) and its worker threads (strip-worker.ts).
// postMessage copies them by the structured clone algorithm, so they hold plain data only.

/** The strip the gallery keeps of each painting: the one read by color. The painting page reads the rest live. */
export const GALLERY_AXIS: AxisName = 'color';

/** What a worker reads from an image file. */
export interface ImageReading {
  /** Its strip along GALLERY_AXIS, one pixel per segment. */
  readonly strip: RgbaImage;
  /** See colorfulness(). */
  readonly colorfulness: number;
}

/** A worker's answer: the reading, or why the image couldn't be read. */
export type WorkerAnswer = { readonly reading: ImageReading } | { readonly error: string };
