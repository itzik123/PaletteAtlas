import { SITE_COLORS } from '../site-colors.ts';
import type { BoardStack, Point } from './board-stack.ts';
import type { LayerWork } from './search-replay.ts';
import type { StackMap, StackPlace } from './stack-map.ts';

/** The glass's radius at most, in CSS pixels, and as a share of the stage's width at most (on a phone's), and its shadow's offset. */
const LOUPE_RADIUS = 84;
const LOUPE_SHARE = 0.2;
const SHADOW = 5;
/** How much room it shows around the nearest paintings, and at least, on the map's scale across. */
const ROOM = 1.6;
const LEAST_REACH = 0.012;
/** How many points draw the patch it enlarges, outlined on the board. */
const PATCH_POINTS = 40;
/** Over the boards' light end, a query there would sit under the glass: the glass rises then. */
const RISES_PAST = 0.6;
const RISE = 24;
/** How far the glass keeps from the pin, and from the patch it enlarges around it, in CSS pixels. */
const CLEARANCE = 14;
const { ink: INK, card: CARD, yellow: YELLOW } = SITE_COLORS;

/** The glass: where its middle stands on the stage, and its radius, in CSS pixels. */
export interface Glass {
  readonly center: Point;
  readonly radius: number;
}

function radiusOn(width: number): number {
  return Math.min(LOUPE_RADIUS, Math.round(width * LOUPE_SHARE));
}

/**
 * The bottom layer around the query, seen from straight above and enlarged under a magnifying
 * glass, which the visitor can move about over the boards: the paintings near the query, faint
 * until the search measures them, and the nearest large, with the query in the middle. Lines lead
 * from the patch of the board it enlarges.
 */
export class Magnifier {
  readonly #map: StackMap;
  readonly #stack: BoardStack;
  #query: StackPlace = { pressed: [0.5, 0.5], true: [0.5, 0.5] };
  /** How far around the query it reaches, on the map's scale across. */
  #reach = LEAST_REACH;
  /** The bottom layer's paintings within its reach. */
  #within: number[] = [];
  /** How far the visitor has moved the glass from where it stands of itself. */
  #moved: Point = [0, 0];

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

  /** The glass on a stage `width` by `height`: its size, and where it stands, wherever the visitor has moved it. */
  glass(width: number, height: number): Glass {
    const radius = radiusOn(width);
    const [x, y] = this.#home(width, height, radius);
    return { center: this.#bounded([x + this.#moved[0], y + this.#moved[1]], width, height, radius), radius };
  }

  /** Moves the glass's middle to a point, or as near it as the glass may go. */
  moveTo(point: Point, width: number, height: number): void {
    const radius = radiusOn(width);
    const [x, y] = this.#bounded(point, width, height, radius);
    const [homeX, homeY] = this.#home(width, height, radius);
    this.#moved = [x - homeX, y - homeY];
  }

  /**
   * Where the glass stands of itself: at the stack's foot on the right, its shadow ending at the
   * stage's edges as the boards' thickness does; or higher, beside the layer above the bottom one,
   * when the query lies at the boards' light end, where the glass would hide it.
   */
  #home(width: number, height: number, radius: number): Point {
    const x = width - radius - SHADOW - 2;
    if (this.#query.pressed[0] <= RISES_PAST) return [x, height - radius - SHADOW - 2];
    const above = this.#stack.boardOf(1);
    return [x, above.top + above.depth / 2 - RISE];
  }

  /**
   * A point for the glass's middle, moved as little as it takes for the glass to stay over the
   * boards (clear of the layers' labels on their left and of the pin's head above them, its shadow
   * within the stage) and to one side of the pin, clear of it and of the patch it enlarges, so that
   * the search's way down stays in sight: dragged across the pin, it hops to the other side. (A
   * patch too wide for either side, as on a gallery of a few paintings, leaves it clear of the pin alone.)
   */
  #bounded([x, y]: Point, width: number, height: number, radius: number): Point {
    const left = this.#stack.left + radius;
    const top = this.#stack.boards[0].top + radius;
    const right = width - radius - SHADOW - 2;
    const bottom = height - radius - SHADOW - 2;
    const [pin] = this.#stack.at(this.#stack.boardOf(0), ...this.#query.pressed);
    const patchReach = Math.max(...this.#patch().map(([px]) => Math.abs(px - pin)));
    let across = Math.min(Math.max(x, left), right);
    // Clear of the patch where a side of the pin has room for that, or else of the pin alone.
    for (const reach of [patchReach + radius + CLEARANCE, radius + CLEARANCE]) {
      const sides = [pin - reach, pin + reach].filter((side) => side >= left && side <= right);
      if (sides.length === 0) continue;
      if (Math.abs(across - pin) < reach) across = sides.reduce((best, side) => (Math.abs(side - x) < Math.abs(best - x) ? side : best));
      break;
    }
    return [across, Math.min(Math.max(y, top), bottom)];
  }

  /** The outline of the patch of the bottom board the glass enlarges, around the query. */
  #patch(): Point[] {
    const { aspect } = this.#map;
    const [queryX, queryY] = this.#query.pressed;
    const board = this.#stack.boardOf(0);
    return Array.from({ length: PATCH_POINTS + 1 }, (_, step) => {
      const angle = (step / PATCH_POINTS) * 2 * Math.PI;
      return this.#stack.at(board, queryX + this.#reach * Math.cos(angle), queryY + this.#reach * aspect * Math.sin(angle));
    });
  }

  draw(context: CanvasRenderingContext2D, { center: [x, y], radius }: Glass, bottom: LayerWork | undefined, nearest: readonly number[]): void {
    this.#drawLeads(context, [x, y], radius);
    context.beginPath();
    context.arc(x + SHADOW, y + SHADOW, radius, 0, 2 * Math.PI);
    context.fillStyle = INK;
    context.fill();
    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, 2 * Math.PI);
    context.fillStyle = CARD;
    context.fill();
    context.clip();
    const scale = radius / this.#reach;
    const { truePlaces, aspect, colors } = this.#map;
    const [queryX, queryY] = this.#query.true;
    const dot = (node: number, size: number, outline: number, alpha = 1): void => {
      context.globalAlpha = alpha;
      context.beginPath();
      context.arc(x + (truePlaces[node * 2] - queryX) * scale, y + ((truePlaces[node * 2 + 1] - queryY) / aspect) * scale, size, 0, 2 * Math.PI);
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
    context.arc(x, y, radius, 0, 2 * Math.PI);
    context.lineWidth = 3;
    context.strokeStyle = INK;
    context.stroke();
  }

  /** The patch of the board it enlarges, outlined, and the lines that lead from it to the glass. */
  #drawLeads(context: CanvasRenderingContext2D, [x, y]: Point, radius: number): void {
    const patch = this.#patch();
    // A line along either side of the way from the patch to the glass, wherever the glass stands:
    // from the patch's point farthest out to that side to the glass's. None once the glass is over it.
    const [patchX, patchY] = this.#stack.at(this.#stack.boardOf(0), ...this.#query.pressed);
    const apart = Math.hypot(x - patchX, y - patchY);
    context.beginPath();
    if (apart > radius) {
      const across: Point = [-(y - patchY) / apart, (x - patchX) / apart];
      const out = ([px, py]: Point): number => px * across[0] + py * across[1];
      for (const side of [1, -1]) {
        const edge = patch.reduce((best, point) => (side * out(point) > side * out(best) ? point : best));
        context.moveTo(...edge);
        context.lineTo(x + side * radius * across[0], y + side * radius * across[1]);
      }
    }
    context.lineWidth = 1.5;
    context.strokeStyle = INK;
    context.stroke();
    context.beginPath();
    patch.forEach((point, index) => (index ? context.lineTo(...point) : context.moveTo(...point)));
    context.lineWidth = 2;
    context.stroke();
  }
}
