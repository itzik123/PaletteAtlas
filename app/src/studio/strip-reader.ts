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
  /** Started with the first request, and again after one fails. */
  #worker: Worker | undefined;
  /** The requests still waiting for an answer, by id. */
  readonly #waiting = new Map<number, (response: StripResponse) => void>();
  #nextId = 0;

  /** The file's picture and strips, or undefined if it can't be read: the browser can't decode it, or the worker failed. */
  async read(file: Blob): Promise<ReadImage | undefined> {
    const worker = (this.#worker ??= this.#start());
    const id = this.#nextId++;
    const { read } = await new Promise<StripResponse>((resolve) => {
      this.#waiting.set(id, resolve);
      worker.postMessage({ id, file } satisfies StripRequest);
    });
    if (!read) return undefined;
    return { picture: read.picture, strips: read.strips.map(({ axis, strip }) => ({ axis, strip: Strip.fromData(strip) })) };
  }

  #start(): Worker {
    const worker = new Worker(new URL('../workers/strip-worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', ({ data }: MessageEvent<StripResponse>) => {
      this.#waiting.get(data.id)?.(data);
      this.#waiting.delete(data.id);
    });
    // The worker failed to load, or crashed (out of memory on a huge image, say), or sent an answer
    // that can't be read.
    worker.addEventListener('error', (event) => {
      event.preventDefault();
      this.#fail(worker);
    });
    worker.addEventListener('messageerror', () => this.#fail(worker));
    return worker;
  }

  /**
   * Fails every request still waiting on a broken worker. The next request starts a new one, rather
   * than starting it here, which would loop forever on a worker that never loads.
   */
  #fail(worker: Worker): void {
    if (worker !== this.#worker) return;
    worker.terminate();
    this.#worker = undefined;
    for (const [id, answer] of this.#waiting) answer({ id });
    this.#waiting.clear();
  }
}
