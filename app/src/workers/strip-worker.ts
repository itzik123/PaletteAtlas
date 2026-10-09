import { ImageStrips } from '@palette-atlas/strip';
import { bitmapPixels } from '../bitmap-pixels.ts';
import type { StripOnAxis, StripRequest, StripResponse } from './strip-messages.ts';

// A Web Worker that decodes image files and reads their strips (ImageStrips.read), the work of a
// few hundred milliseconds for a large image, away from the page's main thread, which stays free
// to answer the user meanwhile. Each answer hands the decoded picture and the strips' arrays over
// to the page rather than copying them.

self.addEventListener('message', async ({ data: { id, file, axes } }: MessageEvent<StripRequest>) => {
  let picture: ImageBitmap;
  try {
    picture = await createImageBitmap(file);
  } catch {
    // Not every image type decodes in every browser (HEIC, for one), and broken files don't.
    postMessage({ id } satisfies StripResponse);
    return;
  }
  try {
    const strips: StripOnAxis[] = ImageStrips.read(bitmapPixels(picture), axes).strips.map(({ axis, strip }) => ({
      axis,
      strip: strip.toData(),
    }));
    const arrays = strips.flatMap(({ strip }) => [strip.sourceMap.segments.buffer, strip.colors.data.buffer]);
    postMessage({ id, read: { picture, strips } } satisfies StripResponse, [picture, ...arrays]);
  } catch (error) {
    console.error(error);
    picture.close();
    postMessage({ id } satisfies StripResponse);
  }
});
