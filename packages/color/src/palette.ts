import { type Coverage, CoveringKMeans } from './covering-kmeans.ts';
import { downscale } from './downscale.ts';
import { type Clusterer, DIMENSIONS, KMeans, type WeightedPoints } from './kmeans.ts';
import { OkLab } from './oklab.ts';
import { bytesToOkLrab } from './oklrab.ts';
import type { Random } from './random.ts';
import { BYTES_PER_PIXEL, Channel, MAX_BYTE, type RgbaImage } from './rgba-image.ts';
import { MAX_PATH_POINTS } from './shortest-path.ts';
import { toeInverse } from './toe.ts';

/** Images are shrunk until their longer side is at most this many pixels before clustering. */
export const PALETTE_WORKING_SIZE = 256;

/**
 * How closely a palette covers its image, in OKLrab. A pixel is covered within 0.15 of a palette
 * color: 7.5 times OKLab's just noticeable difference of 0.02 (as CSS Color 4 takes it), so
 * farther than that it is another color, not a shade of the same one. Half a percent of the pixels
 * may lie farther, about two thirds of a segment in a strip of 128: fewer show as no band of
 * their own. A palette grows up to the most colors a palette path can order.
 */
export const PALETTE_COVERAGE: Coverage = { distance: 0.15, uncoveredShare: 0.005, maxClusters: MAX_PATH_POINTS };

/**
 * The clusterer palettes are made with: k-means for the given number of colors, growing past it
 * while the palette leaves a sizeable group of pixels with no color near it (PALETTE_COVERAGE).
 */
export function paletteClusterer(size: number, random: Random): Clusterer {
  return new CoveringKMeans(new KMeans(size, random), random, PALETTE_COVERAGE);
}

/** Levels per 8-bit channel, which number the 2^24 sRGB colors as (red × levels + green) × levels + blue. */
const CHANNEL_LEVELS = MAX_BYTE + 1;

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
export function extractPalette(image: RgbaImage, clusterer: Clusterer): PaletteColor[] {
  const clusters = clusterer.cluster(clusteringPoints(downscale(image, PALETTE_WORKING_SIZE)));
  const totalWeight = clusters.reduce((sum, { weight }) => sum + weight, 0);
  return clusters
    .map(({ centroid: [toeLightness, a, b], weight }) => ({
      color: new OkLab(toeInverse(toeLightness), a, b),
      share: weight / totalWeight,
    }))
    .sort((first, second) => second.share - first.share);
}

/**
 * An image's visible pixels as points to cluster, in OKLrab: one point per distinct color, weighted by
 * the opacity of all its pixels together. k-means then minimizes the same sum over far fewer points,
 * since images repeat colors: the benchmark renders shrunk to 256 px have 7-33% as many distinct colors
 * as pixels (Celebi, "Improving the performance of k-means for color quantization", 2011).
 */
function clusteringPoints({ data }: RgbaImage): WeightedPoints {
  const pixelCount = data.length / BYTES_PER_PIXEL;
  const coordinates = new Float64Array(pixelCount * DIMENSIONS);
  const weights = new Float64Array(pixelCount);
  const pointOfColor = new Map<number, number>();
  const okLrab = new Float64Array(DIMENSIONS);
  let count = 0;
  for (let offset = 0; offset < data.length; offset += BYTES_PER_PIXEL) {
    const weight = data[offset + Channel.alpha] / MAX_BYTE;
    if (weight === 0) continue;
    const red = data[offset + Channel.red];
    const green = data[offset + Channel.green];
    const blue = data[offset + Channel.blue];
    const color = (red * CHANNEL_LEVELS + green) * CHANNEL_LEVELS + blue;
    let point = pointOfColor.get(color);
    if (point === undefined) {
      point = count++;
      pointOfColor.set(color, point);
      bytesToOkLrab(red, green, blue, okLrab);
      coordinates.set(okLrab, point * DIMENSIONS);
    }
    weights[point] += weight;
  }
  return { coordinates: coordinates.subarray(0, count * DIMENSIONS), weights: weights.subarray(0, count) };
}
