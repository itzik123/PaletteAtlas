import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import type { WorkerAnswer } from './strip-messages.ts';

/**
 * Reads image files into their strips on worker threads, one per core but one, each taking the
 * next image as soon as it is done with the last: 50,000 paintings take minutes rather than hours.
 *
 * Thread pool: the workers start once and serve every image; close() stops them.
 */
export class StripPool {
  readonly #workers: readonly Worker[];

  constructor(size = Math.max(1, availableParallelism() - 1)) {
    this.#workers = Array.from({ length: size }, () => new Worker(new URL('./strip-worker.ts', import.meta.url)));
  }

  /** Reads every image, reporting each one done: a reading of each, or why it failed, in the order given. */
  async read(paths: readonly string[], onDone: (done: number) => void = () => {}): Promise<WorkerAnswer[]> {
    const results = new Array<WorkerAnswer>(paths.length);
    let next = 0;
    let done = 0;
    await Promise.all(
      this.#workers.map(async (worker) => {
        while (next < paths.length) {
          const index = next++;
          results[index] = await ask(worker, paths[index]);
          onDone(++done);
        }
      }),
    );
    return results;
  }

  async close(): Promise<void> {
    await Promise.all(this.#workers.map((worker) => worker.terminate()));
  }
}

/** Sends a worker one image and waits for its answer. */
function ask(worker: Worker, path: string): Promise<WorkerAnswer> {
  return new Promise((resolve, reject) => {
    const fail = (error: Error): void => {
      worker.off('message', answer);
      reject(error);
    };
    const answer = (message: WorkerAnswer): void => {
      worker.off('error', fail);
      resolve(message);
    };
    worker.once('message', answer);
    worker.once('error', fail);
    worker.postMessage(path);
  });
}
