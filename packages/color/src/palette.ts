import { downscale } from './downscale.ts';
import { DIMENSIONS, type KMeans, type WeightedPoints } from './kmeans.ts';
import { OkLab } from './oklab.ts';
import { bytesToOkLrab } from './oklrab.ts';
import { BYTES_PER_PIXEL, Channel, MAX_BYTE, type RgbaImage } from './rgba-image.ts';
import { toeInverse } from './toe.ts';

/** Images are shrunk until their longer side is at most this many pixels before clustering. */
export const PALETTE_WORKING_SIZE = 256;

export interface PaletteColor {
  readonly color: OkLab;
  /** The share of the image's visible pixels that this color stands for, in [0, 1]. */
  readonly share: number;
}

/**
 * The main colors of an image, largest share first. The image is shrunk to
 * PALETTE_WORKING_SIZE by area averaging in linear light, and its pixels are clustered with
 * k-means in OKLab, where distances follow how different colors look. Lightness goes through
 * Ottosson's toe first, so near-blacks that look alike end up in one color.
 */
export function extractPalette(image: RgbaImage, kmeans: KMeans): PaletteColor[] {
  const clusters = kmeans.cluster(clusteringPoints(downscale(image, PALETTE_WORKING_SIZE)));
  const totalWeight = clusters.reduce((sum, { weight }) => sum + weight, 0);
  return clusters
    .map(({ centroid: [toeLightness, a, b], weight }) => ({
      color: new OkLab(toeInverse(toeLightness), a, b),
      share: weight / totalWeight,
    }))
    .sort((first, second) => second.share - first.share);
}

/** An image's visible pixels as points to cluster, in OKLrab, each weighted by its opacity. */
function clusteringPoints({ data }: RgbaImage): WeightedPoints {
  const pixelCount = data.length / BYTES_PER_PIXEL;
  const coordinates = new Float64Array(pixelCount * DIMENSIONS);
  const weights = new Float64Array(pixelCount);
  const point = new Float64Array(DIMENSIONS);
  let count = 0;
  for (let offset = 0; offset < data.length; offset += BYTES_PER_PIXEL) {
    const weight = data[offset + Channel.alpha] / MAX_BYTE;
    if (weight === 0) continue;
    bytesToOkLrab(data[offset + Channel.red], data[offset + Channel.green], data[offset + Channel.blue], point);
    coordinates.set(point, count * DIMENSIONS);
    weights[count] = weight;
    count++;
  }
  return { coordinates: coordinates.subarray(0, count * DIMENSIONS), weights: weights.subarray(0, count) };
}
