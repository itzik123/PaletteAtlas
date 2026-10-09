import { type AxisName, type NamedStrip, Strip } from '@palette-atlas/strip';
import { WorkerChannel } from '../worker-channel.ts';
import type { StripRequest, StripResponse } from '../workers/strip-messages.ts';

/** An image file, decoded and read along the axes asked for. */
export interface ReadImage {
  /** The decoded picture, upright by its EXIF orientation. */
  readonly picture: ImageBitmap;
  readonly strips: readonly NamedStrip[];
}

/**
 * Reads image files into their strips in a Web Worker, so the page never waits on the work.
 *
 * Remote Proxy: stands in for decoding and ImageStrips.read, which run in the worker, and turns
 * the plain data it answers with back into strips.
 */
export class StripReader {
  readonly #channel = new WorkerChannel<StripRequest, StripResponse>(
    () => new Worker(new URL('../workers/strip-worker.ts', import.meta.url), { type: 'module' }),
    (id) => ({ id }),
  );

  /**
   * The file's picture and its strips along some axes, every axis unless told otherwise, or
   * undefined if it can't be read: the browser can't decode it, or the worker failed.
   */
  async read(file: Blob, axes?: readonly AxisName[]): Promise<ReadImage | undefined> {
    const { read } = await this.#channel.ask((id) => ({ id, file, axes }));
    if (!read) return undefined;
    return { picture: read.picture, strips: read.strips.map(({ axis, strip }) => ({ axis, strip: Strip.fromData(strip) })) };
  }
}
