import { DIMENSIONS, squaredDistance } from './kmeans.ts';
import { bytesToOkLrab } from './oklrab.ts';
import type { PaletteColor } from './palette.ts';
import { shortestPath } from './shortest-path.ts';
import { toe } from './toe.ts';

/**
 * A palette's colors in the order of the shortest path through them in OKLrab, so that
 * neighbors look alike, with the darker end first. Built once per palette, it then places any
 * color along the path, which is how the color axis lines up an image's pixels.
 */
export class PalettePath {
  /** The palette's colors in path order. */
  readonly colors: readonly PaletteColor[];
  /** The colors in OKLrab, in path order. */
  readonly #stops: Float64Array;
  /** The way the path runs through each stop: from the stop before it to the stop after it. */
  readonly #directions: Float64Array;
  /** Scratch space for the color being placed, so that placing allocates nothing. */
  readonly #point = new Float64Array(DIMENSIONS);

  constructor(palette: readonly PaletteColor[]) {
    const points = okLrabPoints(palette);
    const order = shortestPath(palette.length, (from, to) =>
      Math.sqrt(squaredDistance(points, from * DIMENSIONS, points, to * DIMENSIONS)),
    );
    if (order.length > 1 && palette[order[0]].color.l > palette[order[order.length - 1]].color.l) order.reverse();
    this.colors = order.map((index) => palette[index]);
    this.#stops = okLrabPoints(this.colors);
    this.#directions = directions(this.#stops);
  }

  /**
   * Where an 8-bit sRGB color falls along the path: between i and i + 1 when stop i is the
   * nearest, and further along the more the color leans from the stop before toward the stop
   * after. Sorting colors by position lines them up along the path.
   */
  position(red: number, green: number, blue: number): number {
    const point = this.#point;
    bytesToOkLrab(red, green, blue, point);
    const stop = this.#nearestStop(point);
    const offset = stop * DIMENSIONS;
    let lean = 0;
    for (let axis = 0; axis < DIMENSIONS; axis++) {
      lean += (point[axis] - this.#stops[offset + axis]) * this.#directions[offset + axis];
    }
    return stop + squeeze(lean);
  }

  #nearestStop(point: Float64Array): number {
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let stop = 0; stop < this.colors.length; stop++) {
      const distance = squaredDistance(point, 0, this.#stops, stop * DIMENSIONS);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = stop;
      }
    }
    return nearest;
  }
}

/** A palette's colors in OKLrab: color i is points[3i..3i + 2]. */
function okLrabPoints(palette: readonly PaletteColor[]): Float64Array {
  return Float64Array.from(palette.flatMap(({ color }) => [toe(color.l), color.a, color.b]));
}

/**
 * For each stop, the vector from the stop before it to the stop after it. An end stands in for
 * its own missing neighbor, so the path leaves the first stop toward the second, and enters the
 * last from the one before.
 */
function directions(stops: Float64Array): Float64Array {
  const count = stops.length / DIMENSIONS;
  const result = new Float64Array(stops.length);
  for (let stop = 0; stop < count; stop++) {
    const before = Math.max(stop - 1, 0) * DIMENSIONS;
    const after = Math.min(stop + 1, count - 1) * DIMENSIONS;
    for (let axis = 0; axis < DIMENSIONS; axis++) {
      result[stop * DIMENSIONS + axis] = stops[after + axis] - stops[before + axis];
    }
  }
  return result;
}

/** Squeezes any number into (0, 1) and keeps numbers in order: 0 lands in the middle. */
function squeeze(value: number): number {
  return 0.5 + Math.atan(value) / Math.PI;
}
