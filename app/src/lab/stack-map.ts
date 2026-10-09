import type { MapPlace, PaintingMap } from '@palette-atlas/gallery';

/**
 * How far past the map's 0 to 1 the few paintings beyond it are pressed, as a share of it: they
 * lie in a narrow margin around the rest rather than stretching the map to hold them.
 */
const MARGIN = 0.025;

/** Where something lands on the stack's map: pressed within its margin, as the boards draw it, and as it is. */
export interface StackPlace {
  readonly pressed: MapPlace;
  readonly true: MapPlace;
}

/**
 * The paintings' map (PaintingMap) as the Lab's boards draw it: each place about 0 to 1, the few
 * past it pressed into a narrow margin, smoothly, so that no two paintings meet at an edge; and
 * each place as it is, for the magnifier's close view.
 */
export class StackMap {
  /** Each painting's place, x then y, pressed within the margin. */
  readonly places: Float32Array;
  /** Each painting's place on the same scale, nothing pressed. */
  readonly truePlaces: Float32Array;
  /** The map's width over its depth, so that both axes keep one scale. */
  readonly aspect: number;
  /** Each painting's average color, as CSS. */
  readonly colors: readonly string[];
  readonly #map: PaintingMap;

  constructor(map: PaintingMap) {
    this.#map = map;
    this.truePlaces = map.places;
    this.places = map.places.map(pressed);
    this.aspect = map.projection.aspect;
    this.colors = Array.from({ length: map.count }, (_, painting) => {
      const [red, green, blue] = map.colors.subarray(painting * 3, painting * 3 + 3);
      return `rgb(${red} ${green} ${blue})`;
    });
  }

  /** Where a vector lands: a visitor's image, say. */
  place(vector: Float32Array): StackPlace {
    const place = this.#map.projection.place(vector);
    return { pressed: [pressed(place[0]), pressed(place[1])], true: place };
  }
}

/** A place past 0 or 1 pressed into the margin beyond it, the farther the closer to the margin's edge. */
function pressed(value: number): number {
  if (value < 0) return -MARGIN * Math.tanh(-value / MARGIN);
  if (value > 1) return 1 + MARGIN * Math.tanh((value - 1) / MARGIN);
  return value;
}
