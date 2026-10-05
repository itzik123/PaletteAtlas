import type { AxisName, StripData } from '@palette-atlas/strip';

// The messages between the page and the strip worker (strip-worker.ts). postMessage copies them
// by the structured clone algorithm, so they hold plain data only.

/** Asks the worker to read an image file. */
export interface StripRequest {
  readonly id: number;
  readonly file: Blob;
}

/** One axis's strip, as plain data. */
export interface StripOnAxis {
  readonly axis: AxisName;
  readonly strip: StripData;
}

/** The worker's answer to the request with the same id. */
export interface StripResponse {
  readonly id: number;
  /** The decoded picture and its strips along every axis, or none for a file the browser can't decode. */
  readonly read?: {
    readonly picture: ImageBitmap;
    readonly strips: readonly StripOnAxis[];
  };
}
