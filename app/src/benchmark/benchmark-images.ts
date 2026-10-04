import chess from '../../../benchmark/chess.webp';
import cube from '../../../benchmark/cube.webp';
import desk from '../../../benchmark/desk.webp';
import galaxy from '../../../benchmark/galaxy.webp';
import laptop from '../../../benchmark/laptop.webp';
import spaceship from '../../../benchmark/spaceship.webp';

/** A point on an image, as fractions of its width and height from the top left. */
export interface Spot {
  readonly x: number;
  readonly y: number;
}

export interface BenchmarkImage {
  readonly name: string;
  readonly url: string;
  /** Where the gradient's two ends are picked until the image is clicked. */
  readonly picks: readonly [Spot, Spot];
}

/** Itzik's ray-traced renders in benchmark/, the standard inputs for visual checks. */
export const BENCHMARK_IMAGES: readonly BenchmarkImage[] = [
  { name: 'Laptop', url: laptop, picks: [{ x: 0.3, y: 0.12 }, { x: 0.17, y: 0.66 }] },
  { name: 'Galaxy', url: galaxy, picks: [{ x: 0.83, y: 0.2 }, { x: 0.9, y: 0.12 }] },
  { name: 'Chess', url: chess, picks: [{ x: 0.14, y: 0.38 }, { x: 0.6, y: 0.66 }] },
  { name: 'Spaceship', url: spaceship, picks: [{ x: 0.42, y: 0.38 }, { x: 0.12, y: 0.12 }] },
  { name: 'Desk', url: desk, picks: [{ x: 0.12, y: 0.12 }, { x: 0.6, y: 0.6 }] },
  { name: 'Cube', url: cube, picks: [{ x: 0.16, y: 0.21 }, { x: 0.82, y: 0.26 }] },
];
