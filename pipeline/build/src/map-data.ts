import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { LinearRgb, OkLab, type RgbaImage } from '@palette-atlas/color';
import { GALLERY_FILES, MapProjection, PaintingMap } from '@palette-atlas/gallery';
import type { Vectors } from '@palette-atlas/hnsw';

/** Red, green and blue. */
const CHANNELS = 3;
/** gzip's best, as for the search index: the file is written once a release. */
const GZIP_LEVEL = 9;

/** What the map holds. */
export interface PaintingMapReport {
  /** The file's size, gzipped. */
  readonly bytes: number;
  /** The share of the vectors' variance the map's plane holds. */
  readonly held: number;
}

/** A strip's colors averaged in linear light, as 8-bit sRGB: the color a painting's dot is drawn in. */
export function averageColor(strip: RgbaImage): LinearRgb {
  return LinearRgb.average(strip) ?? new LinearRgb(0, 0, 0);
}

/**
 * Writes the gallery's map (see GALLERY_FILES.paintingMap) from its color strips in gallery order
 * and their color scheme vectors: each painting's place on the plane in which the vectors differ
 * most, lighter paintings to the right and warmer ones to the front, and its average color.
 */
export async function writePaintingMap(folder: string, strips: readonly RgbaImage[], vectors: Vectors): Promise<PaintingMapReport> {
  const colors = new Uint8Array(strips.length * CHANNELS);
  const lightness = new Float32Array(strips.length);
  const warmth = new Float32Array(strips.length);
  strips.forEach((strip, painting) => {
    const average = averageColor(strip);
    colors.set(average.toSrgb().toBytes(), painting * CHANNELS);
    const { l, b } = OkLab.fromLinear(average);
    lightness[painting] = l;
    warmth[painting] = b;
  });
  const projection = MapProjection.fit(vectors.data, vectors.dimensions, [lightness, warmth]);
  const bytes = gzipSync(PaintingMap.of(projection, vectors.data, colors).toBytes(), { level: GZIP_LEVEL });
  await writeFile(join(folder, GALLERY_FILES.paintingMap), bytes);
  return { bytes: bytes.length, held: projection.held };
}

/** Reads the map in a gallery's folder, as writePaintingMap wrote it. */
export async function readPaintingMap(folder: string): Promise<PaintingMap> {
  return PaintingMap.fromBytes(gunzipSync(await readFile(join(folder, GALLERY_FILES.paintingMap))));
}
