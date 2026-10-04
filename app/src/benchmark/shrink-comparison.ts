import { downscale, LinearRgb, PALETTE_WORKING_SIZE, type RgbaImage } from '@palette-atlas/color';
import { context2d, imageCanvas } from './paint.ts';

/**
 * The image shrunk to the palette's working size twice, side by side: by our area averaging in
 * linear light, and by the browser's own canvas scaling. Each shows the mean light it kept.
 */
export function shrinkComparison(image: RgbaImage): HTMLElement {
  const ours = downscale(image, PALETTE_WORKING_SIZE);
  const element = document.createElement('div');
  element.className = 'shrinks';
  element.append(
    shrunk('Linear light (ours)', ours),
    shrunk('Browser canvas', browserShrink(image, ours.width, ours.height)),
  );
  return element;
}

/** What the browser itself makes of the same shrink, at its highest smoothing quality. */
function browserShrink(image: RgbaImage, width: number, height: number): RgbaImage {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = context2d(canvas);
  context.imageSmoothingQuality = 'high';
  context.drawImage(imageCanvas(image), 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

function shrunk(name: string, image: RgbaImage): HTMLElement {
  const mean = document.createElement('code');
  mean.textContent = LinearRgb.average(image)?.toSrgb().toHex() ?? 'none';
  const caption = document.createElement('figcaption');
  caption.append(name, document.createElement('br'), 'mean light ', mean);
  const figure = document.createElement('figure');
  figure.className = 'shrink';
  figure.append(imageCanvas(image), caption);
  return figure;
}
