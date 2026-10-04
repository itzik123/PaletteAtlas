import { byteToLinear, linearToByte } from './linear-rgb.ts';
import { BYTES_PER_PIXEL, Channel, MAX_BYTE, type RgbaImage } from './rgba-image.ts';

/** The source pixels that one target pixel covers along an axis, and how much of each. */
interface Span {
  readonly first: number;
  readonly weights: Float64Array;
}

/**
 * Shrinks an image until its longer side is at most maxSide pixels, by area averaging in
 * linear light: each new pixel holds the light of the source area it covers, with partly
 * covered pixels weighted by their overlap. Canvas and createImageBitmap scaling usually blend
 * the encoded sRGB values instead, which darkens fine bright detail. An image that already
 * fits comes back as it is.
 */
export function downscale(image: RgbaImage, maxSide: number): RgbaImage {
  const scale = maxSide / Math.max(image.width, image.height);
  if (scale >= 1) return image;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const columns = spans(image.width, width);
  const rows = spans(image.height, height);
  const data = new Uint8ClampedArray(width * height * BYTES_PER_PIXEL);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      writeAreaMean(image, columns[x], rows[y], data, (y * width + x) * BYTES_PER_PIXEL);
    }
  }
  return { width, height, data };
}

/** Writes the mean of the source area under one target pixel into data at offset. */
function writeAreaMean(image: RgbaImage, column: Span, row: Span, data: Uint8ClampedArray, offset: number): void {
  const source = image.data;
  let red = 0;
  let green = 0;
  let blue = 0;
  let opacity = 0;
  let area = 0;
  for (let j = 0; j < row.weights.length; j++) {
    const rowStart = (row.first + j) * image.width;
    for (let i = 0; i < column.weights.length; i++) {
      const overlap = row.weights[j] * column.weights[i];
      const pixel = (rowStart + column.first + i) * BYTES_PER_PIXEL;
      // Color is weighted by opacity as well (premultiplied), so transparent pixels add none.
      const weight = (overlap * source[pixel + Channel.alpha]) / MAX_BYTE;
      red += weight * byteToLinear(source[pixel + Channel.red]);
      green += weight * byteToLinear(source[pixel + Channel.green]);
      blue += weight * byteToLinear(source[pixel + Channel.blue]);
      opacity += weight;
      area += overlap;
    }
  }
  if (opacity > 0) {
    data[offset + Channel.red] = linearToByte(red / opacity);
    data[offset + Channel.green] = linearToByte(green / opacity);
    data[offset + Channel.blue] = linearToByte(blue / opacity);
  }
  data[offset + Channel.alpha] = Math.round((opacity / area) * MAX_BYTE);
}

/** For each of targetSize pixels along an axis, the span of the sourceSize pixels it covers. */
function spans(sourceSize: number, targetSize: number): Span[] {
  const step = sourceSize / targetSize;
  return Array.from({ length: targetSize }, (_, target) => {
    const start = target * step;
    const end = start + step;
    const first = Math.floor(start);
    const last = Math.min(Math.ceil(end), sourceSize) - 1;
    const weights = new Float64Array(last - first + 1);
    for (let source = first; source <= last; source++) {
      weights[source - first] = Math.min(source + 1, end) - Math.max(source, start);
    }
    return { first, weights };
  });
}
