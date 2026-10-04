/**
 * An image as the libraries see it: width × height pixels of 8-bit sRGB with alpha, four bytes
 * per pixel, row by row from the top left.
 *
 * Port (ports and adapters): canvas ImageData and decoded PNGs already have this shape, so the
 * app and the pipeline pass theirs in as they are.
 */
export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray | Uint8Array;
}

/** Bytes per pixel in RgbaImage.data. */
export const BYTES_PER_PIXEL = 4;

/** Where each channel sits within a pixel's four bytes. */
export const Channel = { red: 0, green: 1, blue: 2, alpha: 3 } as const;

/** The largest value of an 8-bit channel. */
export const MAX_BYTE = 255;
