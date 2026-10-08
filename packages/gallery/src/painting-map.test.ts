import { type Random, SeededRandom } from '@palette-atlas/color';
import { describe, expect, it } from 'vitest';
import { MapProjection, PaintingMap } from './painting-map.ts';

const SEED = 3;
const COUNT = 2000;
const DIMENSIONS = 4;
/** The two directions the test's vectors spread along, far more along the first, and a little noise. */
const WIDE = [Math.SQRT1_2, Math.SQRT1_2, 0, 0];
const DEEP = [0, 0, Math.SQRT1_2, -Math.SQRT1_2];
const WIDE_SPREAD = 3;
const DEEP_SPREAD = 1;
const NOISE = 0.05;

/** A standard normal sample (Box-Muller). */
function gaussian(random: Random): number {
  return Math.sqrt(-2 * Math.log(1 - random.next())) * Math.cos(2 * Math.PI * random.next());
}

/** Vectors spread along WIDE and DEEP around (1, 2, 3, 4), and how far along each every vector lies. */
function spread(random: Random): { data: Float32Array; along: [Float32Array, Float32Array] } {
  const data = new Float32Array(COUNT * DIMENSIONS);
  const along: [Float32Array, Float32Array] = [new Float32Array(COUNT), new Float32Array(COUNT)];
  for (let vector = 0; vector < COUNT; vector++) {
    along[0][vector] = gaussian(random) * WIDE_SPREAD;
    along[1][vector] = gaussian(random) * DEEP_SPREAD;
    for (let d = 0; d < DIMENSIONS; d++) {
      data[vector * DIMENSIONS + d] = d + 1 + along[0][vector] * WIDE[d] + along[1][vector] * DEEP[d] + gaussian(random) * NOISE;
    }
  }
  return { data, along };
}

const dot = (first: ArrayLike<number>, second: ArrayLike<number>): number => Array.from(first).reduce((sum, value, d) => sum + value * second[d], 0);

describe('MapProjection', () => {
  const { data, along } = spread(new SeededRandom(SEED));

  it('lays the plane along the two directions the vectors spread most, each turned to rise with its guide', () => {
    const projection = MapProjection.fit(data, DIMENSIONS, along);
    expect(dot(projection.axes[0], WIDE)).toBeGreaterThan(0.999);
    expect(dot(projection.axes[1], DEEP)).toBeGreaterThan(0.999);
    // The noise is all the plane leaves out.
    expect(projection.held).toBeGreaterThan(0.99);
    // Turned the other way round, the guides turn the axes round with them.
    const reversed = MapProjection.fit(data, DIMENSIONS, [along[0].map((value) => -value), along[1]]);
    expect(dot(reversed.axes[0], WIDE)).toBeLessThan(-0.999);
  });

  it('places the vectors so that all but the few at either end lie from 0 to 1, keeping one scale across and down', () => {
    const projection = MapProjection.fit(data, DIMENSIONS, along);
    const places = Array.from({ length: COUNT }, (_, vector) => projection.place(data.subarray(vector * DIMENSIONS, (vector + 1) * DIMENSIONS)));
    for (const axis of [0, 1]) {
      const inside = places.filter((place) => place[axis] >= 0 && place[axis] <= 1).length;
      expect(inside / COUNT).toBeGreaterThan(0.99);
    }
    // Three times wider than deep, as the vectors spread.
    expect(projection.aspect).toBeCloseTo(WIDE_SPREAD / DEEP_SPREAD, 0);
  });
});

describe('PaintingMap', () => {
  const { data, along } = spread(new SeededRandom(SEED + 1));
  const colors = Uint8Array.from({ length: COUNT * 3 }, (_, at) => (at * 37) % 256);
  const map = PaintingMap.of(MapProjection.fit(data, DIMENSIONS, along), data, colors);

  it('reads back from its bytes as written: its projection, every color, and every place within a step of 1/65,535 of its axis', () => {
    const read = PaintingMap.fromBytes(map.toBytes());
    expect(read.count).toBe(COUNT);
    expect(read.colors).toEqual(colors);
    expect(read.projection).toEqual(map.projection);
    for (const axis of [0, 1]) {
      const values = Array.from({ length: COUNT }, (_, painting) => map.places[painting * 2 + axis]);
      const step = (Math.max(...values) - Math.min(...values)) / 65_535;
      const worst = Math.max(...values.map((value, painting) => Math.abs(read.places[painting * 2 + axis] - value)));
      expect(worst).toBeLessThanOrEqual(step / 2 + 1e-6);
    }
    expect(read.toBytes()).toEqual(map.toBytes());
  });

  it('refuses bytes that are not a map, or that end too soon', () => {
    const bytes = map.toBytes();
    expect(() => PaintingMap.fromBytes(Uint8Array.from('not a map at all', (letter) => letter.charCodeAt(0)))).toThrow(/not a painting map/);
    expect(() => PaintingMap.fromBytes(bytes.subarray(0, bytes.length - 1))).toThrow(RangeError);
  });
});
