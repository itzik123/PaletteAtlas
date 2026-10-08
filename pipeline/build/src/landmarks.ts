import { BYTES_PER_PIXEL, bytesToOkLrab, KMeans, type RgbaImage, SeededRandom } from '@palette-atlas/color';
import type { Vectors } from '@palette-atlas/hnsw';
import { colorSchemeDistance } from '@palette-atlas/vectorize';

/** How many landmarks the search index's top layer holds: one painting per color family. */
export const LANDMARK_COUNT = 8;
/** The seed the families are found with, so that the same gallery always gives the same landmarks. */
const SEED = 1;
/** OKLrab's three coordinates. */
const CHANNELS = 3;

/**
 * The paintings for the search index's top layer, where every search starts (HnswOptions.landmarks):
 * the gallery sorted into LANDMARK_COUNT color families by k-means over each painting's mean color
 * in OKLrab, and from each family the painting whose color scheme vector lies nearest the family's
 * mean vector, its most typical. On the gallery they run from near-black to near-white, and a search
 * starting from them measures no more than one from the two paintings the random draw left on top
 * (CLAUDE.md, Search index).
 */
export function landmarks(strips: readonly RgbaImage[], vectors: Vectors): number[] {
  const colors = meanColors(strips);
  const clusters = new KMeans(LANDMARK_COUNT, new SeededRandom(SEED)).cluster({ coordinates: colors, weights: new Float64Array(strips.length).fill(1) });
  const families = nearestOf(colors, clusters.map(({ centroid }) => centroid));
  return clusters.map((_, family) => mostTypical(vectors, families, family)).filter((painting) => painting >= 0);
}

/** Each strip's colors averaged in OKLrab, three numbers a strip. */
function meanColors(strips: readonly RgbaImage[]): Float64Array {
  const means = new Float64Array(strips.length * CHANNELS);
  const color = new Float64Array(CHANNELS);
  strips.forEach(({ data, width, height }, painting) => {
    const pixels = width * height;
    for (let pixel = 0; pixel < pixels; pixel++) {
      const at = pixel * BYTES_PER_PIXEL;
      bytesToOkLrab(data[at], data[at + 1], data[at + 2], color);
      for (let channel = 0; channel < CHANNELS; channel++) means[painting * CHANNELS + channel] += color[channel] / pixels;
    }
  });
  return means;
}

/** For each color, the index of the centroid nearest it. */
function nearestOf(colors: Float64Array, centroids: readonly (readonly number[])[]): Int32Array {
  const nearest = new Int32Array(colors.length / CHANNELS);
  for (let painting = 0; painting < nearest.length; painting++) {
    let best = Number.POSITIVE_INFINITY;
    centroids.forEach((centroid, family) => {
      let squared = 0;
      for (let channel = 0; channel < CHANNELS; channel++) squared += (colors[painting * CHANNELS + channel] - centroid[channel]) ** 2;
      if (squared < best) {
        best = squared;
        nearest[painting] = family;
      }
    });
  }
  return nearest;
}

/** The family's painting whose vector lies nearest the mean of its members' vectors, or -1 for a family with none. */
function mostTypical({ data, dimensions, count }: Vectors, families: Int32Array, family: number): number {
  const mean = new Float32Array(dimensions);
  let members = 0;
  for (let painting = 0; painting < count; painting++) {
    if (families[painting] !== family) continue;
    members++;
    for (let d = 0; d < dimensions; d++) mean[d] += data[painting * dimensions + d];
  }
  for (let d = 0; d < dimensions; d++) mean[d] /= members;
  let typical = -1;
  let nearest = Number.POSITIVE_INFINITY;
  for (let painting = 0; painting < count; painting++) {
    if (families[painting] !== family) continue;
    const distance = colorSchemeDistance(mean, 0, data, painting * dimensions, dimensions);
    if (distance < nearest) {
      nearest = distance;
      typical = painting;
    }
  }
  return typical;
}
