import { type NamedStrip, Strip } from '@palette-atlas/strip';
import type { StripRequest, StripResponse } from '../workers/strip-messages.ts';

/** An image file, decoded and read along every axis. */
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
  readonly #worker = new Worker(new URL('../workers/strip-worker.ts', import.meta.url), { type: 'module' });
  /** The requests still waiting for an answer, by id. */
  readonly #waiting = new Map<number, (response: StripResponse) => void>();
  #nextId = 0;

  constructor() {
    this.#worker.addEventListener('message', ({ data }: MessageEvent<StripResponse>) => {
      this.#waiting.get(data.id)?.(data);
      this.#waiting.delete(data.id);
    });
  }

  /** The file's picture and strips, or undefined if the browser can't decode it. */
  async read(file: Blob): Promise<ReadImage | undefined> {
    const id = this.#nextId++;
    const { read } = await new Promise<StripResponse>((resolve) => {
      this.#waiting.set(id, resolve);
      this.#worker.postMessage({ id, file } satisfies StripRequest);
    });
    if (!read) return undefined;
    return { picture: read.picture, strips: read.strips.map(({ axis, strip }) => ({ axis, strip: Strip.fromData(strip) })) };
  }
}
