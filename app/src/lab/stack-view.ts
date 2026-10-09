import { SITE_COLORS } from '../site-colors.ts';
import { type Board, BoardStack, PIN_HEAD, type Point, THICKNESS } from './board-stack.ts';
import { type Dot, DotHits } from './dot-hits.ts';
import type { IndexLayers } from './index-layers.ts';
import { type Glass, Magnifier } from './magnifier.ts';
import type { SearchReplay } from './search-replay.ts';
import type { StackMap, StackPlace } from './stack-map.ts';

const { ink: INK, card: CARD, yellow: YELLOW } = SITE_COLORS;
/** Dots' radii by layer, in CSS pixels: the higher the layer, the fewer its paintings and the larger their dots. */
const RADII = [1.15, 2.1, 3.7, 5.6, 7.5, 8.5];
/** From this layer up, dots are few enough to outline. */
const OUTLINED_FROM = 2;
/** The board searched now is tinted, faintly. */
const ACTIVE_TINT = 'rgb(255 200 31 / 0.16)';
/** The links of the layer above the bottom one are many, so faint; those higher up fewer, so darker. */
const LINKS = { crowded: { width: 0.5, color: 'rgb(24 20 15 / 0.06)' }, sparse: { width: 1, color: 'rgb(24 20 15 / 0.22)' } } as const;
/** The links a search looked along, and the paintings it measured on the bottom layer. */
const FOLLOWED = 'rgb(24 20 15 / 0.45)';
const MEASURED = 'rgb(24 20 15 / 0.35)';
/** The nearest paintings' dots on the bottom layer, and the query's on every board. */
const NEAREST_RADIUS = 6.5;

function radiusOn(level: number): number {
  return RADII[Math.min(level, RADII.length - 1)];
}

/**
 * The search index's layers as a stack of card boards (BoardStack), every painting a dot of its
 * own color on each layer it lives on, its links drawn faintly; and over them a search replayed
 * up to some step: the walk it took on each layer, the way down to the next, what it measured
 * and kept on the bottom one, and its nearest so far, with a magnifier over them that can be
 * moved (Magnifier). The
 * query's image rides a pin that runs down through every board to where the query lands.
 *
 * What stays put while a search plays (the boards, their links and dots, and the pin) is drawn
 * once into a canvas of its own, which every frame copies before drawing the search over it.
 */
export class StackView {
  readonly canvas = document.createElement('canvas');
  readonly #map: StackMap;
  readonly #layers: IndexLayers;
  readonly #stack: BoardStack;
  readonly #magnifier: Magnifier;
  readonly #hits = new DotHits();
  #query: StackPlace = { pressed: [0.5, 0.5], true: [0.5, 0.5] };
  #size = { width: 0, height: 0 };
  #still: HTMLCanvasElement | undefined;

  constructor(map: StackMap, layers: IndexLayers) {
    this.#map = map;
    this.#layers = layers;
    this.#stack = new BoardStack(layers.topLevel);
    this.#magnifier = new Magnifier(map, this.#stack);
  }

  /** The boards, the top layer first. */
  get boards(): readonly Board[] {
    return this.#stack.boards;
  }

  /** The magnifying glass over the bottom layer: where it stands, and its size. */
  get glass(): Glass {
    return this.#magnifier.glass(this.#size.width, this.#size.height);
  }

  /** Moves the magnifying glass's middle to a point, or as near it as the glass may go (over the boards). */
  moveGlass(center: Point): void {
    this.#magnifier.moveTo(center, this.#size.width, this.#size.height);
  }

  /** Where the pin stands across the stage: over where the query lands on the top board. */
  get pinX(): number {
    return this.#place(this.#stack.boards[0], this.#query.pressed)[0];
  }

  /** Lays the stack out over a stage `width` by `height` in CSS pixels, leaving `left` free for the labels. */
  layout(width: number, height: number, left: number): void {
    this.#size = { width, height };
    this.canvas.width = Math.round(width * devicePixelRatio);
    this.canvas.height = Math.round(height * devicePixelRatio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.#stack.layout(width, height, left);
    this.#still = undefined;
  }

  /** Sets where the query lands, and the paintings the magnifier holds: its nearest. */
  aim(query: StackPlace, nearest: readonly number[]): void {
    this.#query = query;
    this.#magnifier.aim(query, nearest);
    this.#still = undefined;
  }

  /** The painting whose dot is under a point, if any, preferring those in `preferred`; a finger picks from farther. */
  pick(x: number, y: number, preferred: ReadonlySet<number>, coarse = false): Dot | undefined {
    this.#still ??= this.#drawStill();
    return this.#hits.pick(x, y, preferred, coarse);
  }

  /** Draws the stack with a search over it, as far as it is replayed, its nearest so far, and a painting pointed at. */
  draw(replay: SearchReplay, nearest: readonly number[], pointed?: Dot): void {
    const context = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.#still ??= this.#drawStill();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.drawImage(this.#still, 0, 0);
    context.scale(devicePixelRatio, devicePixelRatio);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    if (!replay.done && replay.level >= 0) {
      this.#outline(context, this.#stack.boardOf(replay.level));
      context.fillStyle = ACTIVE_TINT;
      context.fill();
    }
    for (const board of this.#stack.boards) this.#drawWork(context, board, replay);
    this.#drawWaysDown(context, replay);
    const bottom = this.#stack.boardOf(0);
    for (const node of nearest) disc(context, this.#dot(bottom, node), NEAREST_RADIUS, this.#map.colors[node], 2.2);
    for (const board of this.#stack.boards) disc(context, this.#place(board, this.#query.pressed), NEAREST_RADIUS, YELLOW, 2.5);
    this.#magnifier.draw(context, this.glass, replay.layers.get(0), nearest);
    if (pointed) ring(context, [pointed.x, pointed.y], Math.max(7, pointed.radius + 4), 2.5);
  }

  /** The boards, their links and dots, and the pin: all that stays put while a search plays. */
  #drawStill(): HTMLCanvasElement {
    const still = document.createElement('canvas');
    still.width = this.canvas.width;
    still.height = this.canvas.height;
    const context = still.getContext('2d') as CanvasRenderingContext2D;
    context.scale(devicePixelRatio, devicePixelRatio);
    this.#hits.clear();
    // The pin runs from its head down through every board: seen between them here, and on each
    // board (below) from where it comes down onto it to where it goes through, at the query.
    const pinX = this.pinX;
    const pin = (from: number, to: number): void => {
      context.beginPath();
      context.moveTo(pinX, from);
      context.lineTo(pinX, to);
      context.lineWidth = 2;
      context.strokeStyle = INK;
      context.stroke();
    };
    pin(PIN_HEAD, this.#place(this.#stack.boardOf(0), this.#query.pressed)[1]);
    for (const board of this.#stack.boards) {
      this.#drawBoard(context, board);
      pin(this.#stack.meets(board, pinX), this.#place(board, this.#query.pressed)[1]);
    }
    return still;
  }

  /** A board: its thickness under its front and right edges, its face, its links and its dots. */
  #drawBoard(context: CanvasRenderingContext2D, board: Board): void {
    const [, backRight, frontRight, frontLeft] = this.#stack.corners(board);
    const below = ([x, y]: Point): Point => [x + THICKNESS * 0.5, y + THICKNESS];
    context.beginPath();
    for (const point of [frontLeft, frontRight, backRight, below(backRight), below(frontRight), below(frontLeft)]) context.lineTo(...point);
    context.closePath();
    context.fillStyle = INK;
    context.fill();
    this.#outline(context, board);
    context.fillStyle = CARD;
    context.fill();
    context.lineJoin = 'round';
    context.lineWidth = 2.5;
    context.strokeStyle = INK;
    context.stroke();
    const { level } = board;
    const members = this.#layers.nodesOn(level);
    if (level > 0) {
      context.beginPath();
      for (const node of members) {
        const from = this.#dot(board, node);
        for (const link of this.#layers.linksOf(node, level)) {
          // Each link once, though both its ends list it.
          if (link < node) continue;
          context.moveTo(...from);
          context.lineTo(...this.#dot(board, link));
        }
      }
      const links = level === 1 ? LINKS.crowded : LINKS.sparse;
      context.lineWidth = links.width;
      context.strokeStyle = links.color;
      context.stroke();
    }
    const radius = radiusOn(level);
    for (const node of members) {
      const [x, y] = this.#dot(board, node);
      context.beginPath();
      context.arc(x, y, radius, 0, 2 * Math.PI);
      context.fillStyle = this.#map.colors[node];
      context.fill();
      if (level >= OUTLINED_FROM) {
        context.lineWidth = level > OUTLINED_FROM ? 2 : 1.2;
        context.strokeStyle = INK;
        context.stroke();
      }
      this.#hits.add({ node, level, x, y, radius });
    }
  }

  /**
   * What a search did on a board: on an upper layer, the links it looked along, the paintings it
   * measured and the walk it took; on the bottom one, the paintings it measured and kept.
   */
  #drawWork(context: CanvasRenderingContext2D, board: Board, replay: SearchReplay): void {
    const work = replay.layers.get(board.level);
    if (!work) return;
    if (board.level === 0) {
      for (const node of work.measured.keys()) disc(context, this.#dot(board, node), 1.3, MEASURED);
      for (const node of work.kept) disc(context, this.#dot(board, node), 2.6, this.#map.colors[node], 0.8);
      return;
    }
    context.beginPath();
    for (const [from, to] of work.followed) {
      context.moveTo(...this.#dot(board, from));
      context.lineTo(...this.#dot(board, to));
    }
    context.lineWidth = 1;
    context.strokeStyle = FOLLOWED;
    context.stroke();
    for (const node of work.measured.keys()) ring(context, this.#dot(board, node), radiusOn(board.level) + 3, 1.3);
    context.beginPath();
    work.expanded.forEach((node, index) => (index ? context.lineTo(...this.#dot(board, node)) : context.moveTo(...this.#dot(board, node))));
    context.lineWidth = 3.5;
    context.strokeStyle = INK;
    context.stroke();
  }

  /** Each way down the search took: from where its walk on a layer stopped to the same painting on the layer below. */
  #drawWaysDown(context: CanvasRenderingContext2D, replay: SearchReplay): void {
    for (const board of this.#stack.boards) {
      if (board.level === 0 || (!replay.done && board.level <= replay.level)) continue;
      const [exit] = replay.layers.get(board.level)?.kept ?? [];
      if (exit === undefined) continue;
      const from = this.#dot(board, exit);
      const to = this.#dot(this.#stack.boardOf(board.level - 1), exit);
      context.beginPath();
      context.moveTo(...from);
      context.lineTo(...to);
      context.lineWidth = 3;
      context.strokeStyle = INK;
      context.stroke();
      disc(context, to, 4, INK);
      disc(context, from, radiusOn(board.level) + 1, this.#map.colors[exit], 3);
    }
  }

  #outline(context: CanvasRenderingContext2D, board: Board): void {
    context.beginPath();
    for (const point of this.#stack.corners(board)) context.lineTo(...point);
    context.closePath();
  }

  #place(board: Board, [x, y]: readonly [number, number]): Point {
    return this.#stack.at(board, x, y);
  }

  #dot(board: Board, node: number): Point {
    const { places } = this.#map;
    return this.#stack.at(board, places[node * 2], places[node * 2 + 1]);
  }
}

function disc(context: CanvasRenderingContext2D, [x, y]: Point, radius: number, fill: string, outline = 0): void {
  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI);
  context.fillStyle = fill;
  context.fill();
  if (outline) {
    context.lineWidth = outline;
    context.strokeStyle = INK;
    context.stroke();
  }
}

function ring(context: CanvasRenderingContext2D, [x, y]: Point, radius: number, width: number): void {
  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI);
  context.lineWidth = width;
  context.strokeStyle = INK;
  context.stroke();
}
