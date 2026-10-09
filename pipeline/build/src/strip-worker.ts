import { parentPort } from 'node:worker_threads';
import { ImageStrips } from '@palette-atlas/strip';
import sharp from 'sharp';
import { colorfulness } from './colorfulness.ts';
import { readImage } from './image-file.ts';
import { GALLERY_AXIS, type WorkerAnswer } from './strip-messages.ts';

// A worker thread of the strip pool: it reads each image file it is sent into the strip the
// gallery keeps (ImageStrips.read) and its colorfulness, and answers with them, or with why it couldn't.

if (!parentPort) throw new Error('strip-worker.ts runs only as a worker thread');
const port = parentPort;

// Every core already runs a worker, so each decodes on one thread rather than a libvips pool.
sharp.concurrency(1);

port.on('message', async (path: string) => {
  let answer: WorkerAnswer;
  try {
    const { strips, palette } = ImageStrips.read(await readImage(path), [GALLERY_AXIS]);
    answer = { reading: { strip: strips[0].strip.toImage(), colorfulness: colorfulness(palette) } };
  } catch (error) {
    answer = { error: String(error) };
  }
  port.postMessage(answer);
});
