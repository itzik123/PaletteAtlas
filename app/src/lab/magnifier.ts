import { SITE_COLORS } from '../site-colors.ts';
import type { Board, BoardStack, Point } from './board-stack.ts';
import type { LayerWork } from './search-replay.ts';
import type { StackMap, StackPlace } from './stack-map.ts';

/** The glass's radius, and its shadow's offset, in CSS pixels. */
const LOUPE_RADIUS = 84;
const SHADOW = 5;
/** How much room it shows around the nearest paintings, and at least, on the map's scale across. */
const ROOM = 1.6;
const LEAST_REACH = 0.012;
/** How many points draw the patch it enlarges, outlined on the board. */
const PATCH_POINTS = 40;
/** Over the boards' light end, a query there would sit under the glass: the glass rises then. */
const RISES_PAST = 0.6;
const RISE = 24;
const { ink: INK, card: CARD, yellow: YELLOW } = SITE_COLORS;

/**
 * The bottom layer around the query, seen from straight above and enlarged under a magnifying
 * glass: the paintings near the query, faint until the search measures them, and the nearest
 * large, with the query in the middle. Lines lead from the patch of the board it enlarges.
 */
export class Magnifier {
  readonly #map: StackMap;
  readonly #stack: BoardStack;
  #query: StackPlace = { pressed: [0.5, 0.5], true: [0.5, 0.5] };
  /** How far around the query it reaches, on the map's scale across. */
  #reach = LEAST_REACH;
  /** The bottom layer's paintings within its reach. */
  #within: number[] = [];

  constructor(map: StackMap, stack: BoardStack) {
    this.#map = map;
    this.#stack = stack;
  }

  /** Centers it on the query, reaching far enough to hold its nearest paintings with room around them. */
  aim(query: StackPlace, nearest: readonly number[]): void {
    this.#query = query;
    const across = (node: number): number => this.#across(node);
    this.#reach = Math.max(LEAST_REACH, ROOM * Math.max(0, ...nearest.map(across)));
    this.#within = [];
    const count = this.#map.truePlaces.length / 2;
    for (let node = 0; node < count; node++) if (across(node) <= this.#reach * 1.05) this.#within.push(node);
  }

  /** How far a painting lies from the query on the map, on its scale across. */
  #across(node: number): number {
    const { truePlaces, aspect } = this.#map;
    const [x, y] = this.#query.true;
    return Math.hypot(truePlaces[node * 2] - x, (truePlaces[node * 2 + 1] - y) / aspect);
  }

  /**
   * Where the glass stands on a stage `width` by `height`: at the stack's foot on the right, its
   * shadow ending at the stage's edges as the boards' thickness does; or higher, beside the layer
   * above the bottom one, when the query lies at the boards' light end, where the glass would hide it.
   */
  center(width: number, height: number): Point {
    const x = width - LOUPE_RADIUS - SHADOW - 2;
    if (this.#query.pressed[0] <= RISES_PAST) return [x, height - LOUPE_RADIUS - SHADOW - 2];
    const above = this.#stack.boardOf(1);
    return [x, above.top + above.depth / 2 - RISE];
  }

  draw(context: CanvasRenderingContext2D, [x, y]: Point, bottom: LayerWork | undefined, nearest: readonly number[]): void {
    this.#drawLeads(context, [x, y], this.#stack.boardOf(0));
    context.beginPath();
    context.arc(x + SHADOW, y + SHADOW, LOUPE_RADIUS, 0, 2 * Math.PI);
    context.fillStyle = INK;
    context.fill();
    context.save();
    context.beginPath();
    context.arc(x, y, LOUPE_RADIUS, 0, 2 * Math.PI);
    context.fillStyle = CARD;
    context.fill();
    context.clip();
    const scale = LOUPE_RADIUS / this.#reach;
    const { truePlaces, aspect, colors } = this.#map;
    const [queryX, queryY] = this.#query.true;
    const dot = (node: number, radius: number, outline: number, alpha = 1): void => {
      context.globalAlpha = alpha;
      context.beginPath();
      context.arc(x + (truePlaces[node * 2] - queryX) * scale, y + ((truePlaces[node * 2 + 1] - queryY) / aspect) * scale, radius, 0, 2 * Math.PI);
      context.fillStyle = colors[node];
      context.fill();
      if (outline) {
        context.lineWidth = outline;
        context.strokeStyle = INK;
        context.stroke();
      }
      context.globalAlpha = 1;
    };
    // Paintings the search never measured stay faint; those it measured, and those it kept, stand out.
    const top = new Set(nearest);
    for (const node of this.#within) if (!bottom?.measured.has(node)) dot(node, 2.2, 0, 0.3);
    for (const node of this.#within) if (bottom?.measured.has(node) && !bottom.kept.has(node)) dot(node, 2.6, 0.8, 0.8);
    for (const node of this.#within) if (bottom?.kept.has(node) && !top.has(node)) dot(node, 3.6, 1.2);
    for (const node of nearest) dot(node, 7, 2.4);
    context.beginPath();
    context.arc(x, y, 7.5, 0, 2 * Math.PI);
    context.fillStyle = YELLOW;
    context.fill();
    context.lineWidth = 2.5;
    context.strokeStyle = INK;
    context.stroke();
    context.restore();
    context.beginPath();
    context.arc(x, y, LOUPE_RADIUS, 0, 2 * Math.PI);
    context.lineWidth = 3;
    context.strokeStyle = INK;
    context.stroke();
  }

  /** The patch of the board it enlarges, outlined, and the lines that lead from it to the glass. */
  #drawLeads(context: CanvasRenderingContext2D, [x, y]: Point, board: Board): void {
    const { aspect } = this.#map;
    const [queryX, queryY] = this.#query.pressed;
    const patch = Array.from({ length: PATCH_POINTS + 1 }, (_, step) => {
      const angle = (step / PATCH_POINTS) * 2 * Math.PI;
      return this.#stack.at(board, queryX + this.#reach * Math.cos(angle), queryY + this.#reach * aspect * Math.sin(angle));
    });
    const highest = patch.reduce((best, point) => (point[1] < best[1] ? point : best));
    const lowest = patch.reduce((best, point) => (point[1] > best[1] ? point : best));
    context.beginPath();
    context.moveTo(...highest);
    context.lineTo(x, y - LOUPE_RADIUS);
    context.moveTo(...lowest);
    context.lineTo(x, y + LOUPE_RADIUS);
    context.lineWidth = 1.5;
    context.strokeStyle = INK;
    context.stroke();
    context.beginPath();
    patch.forEach((point, index) => (index ? context.lineTo(...point) : context.moveTo(...point)));
    context.lineWidth = 2;
    context.stroke();
  }
}
