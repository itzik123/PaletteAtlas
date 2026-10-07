/** A message to a worker, or its answer to one, matched to each other by id. */
interface Message {
  readonly id: number;
}

/**
 * The page's side of a Web Worker that answers every request with a response of the same id. The
 * worker starts with the first request, and again after it breaks: a worker that fails to load,
 * crashes (out of memory, say) or sends an answer that can't be read fails every request still
 * waiting, rather than leaving the page waiting forever.
 */
export class WorkerChannel<Request extends Message, Response extends Message> {
  readonly #start: () => Worker;
  readonly #failed: (id: number) => Response;
  #worker: Worker | undefined;
  /** The requests still waiting for an answer, by id. */
  readonly #waiting = new Map<number, (response: Response) => void>();
  #nextId = 0;

  /** Starts the worker with `start`; `failed` is the answer to a request the worker broke on. */
  constructor(start: () => Worker, failed: (id: number) => Response) {
    this.#start = start;
    this.#failed = failed;
  }

  /** Posts the request made with a fresh id, handing the worker the transferred objects, and waits for its answer. */
  ask(request: (id: number) => Request, transfer: Transferable[] = []): Promise<Response> {
    const worker = (this.#worker ??= this.#open());
    const id = this.#nextId++;
    return new Promise<Response>((resolve) => {
      this.#waiting.set(id, resolve);
      worker.postMessage(request(id), transfer);
    });
  }

  #open(): Worker {
    const worker = this.#start();
    worker.addEventListener('message', ({ data }: MessageEvent<Response>) => {
      this.#waiting.get(data.id)?.(data);
      this.#waiting.delete(data.id);
    });
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
    for (const [id, answer] of this.#waiting) answer(this.#failed(id));
    this.#waiting.clear();
  }
}
