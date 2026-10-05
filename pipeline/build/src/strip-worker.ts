import { parentPort } from 'node:worker_threads';
import { ImageStrips } from '@palette-atlas/strip';
import sharp from 'sharp';
import { colorfulness } from './colorfulness.ts';
import { readImage } from './image-file.ts';
import type { ImageReading, WorkerAnswer } from './strip-messages.ts';

// A worker thread of the strip pool: it reads each image file it is sent into its strips
// (ImageStrips.read) and its colorfulness, and answers with them, or with why it couldn't.

if (!parentPort) throw new Error('strip-worker.ts runs only as a worker thread');
const port = parentPort;

// Every core already runs a worker, so each decodes on one thread rather than a libvips pool.
sharp.concurrency(1);

port.on('message', async (path: string) => {
  let answer: WorkerAnswer;
  try {
    const read = ImageStrips.read(await readImage(path));
    const reading: ImageReading = {
      strips: read.strips.map(({ axis, strip }) => ({ axis, colors: strip.toImage() })),
      colorfulness: colorfulness(read.palette),
    };
    answer = { reading };
  } catch (error) {
    answer = { error: String(error) };
  }
  port.postMessage(answer);
});
