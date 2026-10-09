/** A point on the page, in CSS pixels from the stage's top left corner. */
export type Point = [x: number, y: number];

/** A layer's board on the page: the top of its back edge, and how deep it looks from front to back. */
export interface Board {
  readonly level: number;
  readonly top: number;
  readonly depth: number;
}

/** The pin's head, at the top of the stage, and the room under it before the first board. */
export const PIN_HEAD = 54;
const PIN_ROOM = PIN_HEAD + 16;
/** The room between one board and the next, and each board's thickness, in CSS pixels. */
const GAP = 22;
export const THICKNESS = 7;
/** How far a board's back edge sits to the right of its front edge, as a share of its depth. */
const SLANT = 1.15;
/** The room inside a board around the map, as shares of its width and depth. */
const PAD_X = 0.045;
const PAD_Y = 0.11;
/** The room kept clear of the stage's edges for the boards' outlines. */
const EDGE = 2;

/**
 * The index's layers as a stack of card boards seen from the front and above, the top layer
 * highest, filling the stage beside a column for their labels: where each board lies, and where
 * a place on the paintings' map lands on it. Every board is the same size, so a painting sits at
 * the same place on each layer it lives on.
 */
export class BoardStack {
  readonly #levels: number;
  #boards: Board[] = [];
  #left = 0;
  #width = 0;
  #slant = 0;

  /** A stack of boards for the layers 0 up to `topLevel`. */
  constructor(topLevel: number) {
    this.#levels = topLevel + 1;
  }

  /** The boards, the top layer first. */
  get boards(): readonly Board[] {
    return this.#boards;
  }

  /** Where the boards begin on the left: their front edges' left ends. */
  get left(): number {
    return this.#left;
  }

  /** Lays the boards out over a stage `width` by `height`, leaving `left` free for the labels. */
  layout(width: number, height: number, left: number): void {
    const depth = (height - PIN_ROOM - (this.#levels - 1) * GAP - THICKNESS - EDGE) / this.#levels;
    this.#slant = depth * SLANT;
    this.#left = left;
    this.#width = width - left - this.#slant - THICKNESS * 0.5 - EDGE;
    this.#boards = Array.from({ length: this.#levels }, (_, rank) => ({
      level: this.#levels - 1 - rank,
      top: PIN_ROOM + rank * (depth + GAP),
      depth,
    }));
  }

  boardOf(level: number): Board {
    const board = this.#boards.find((candidate) => candidate.level === level);
    if (!board) throw new RangeError(`No board for layer ${level}`);
    return board;
  }

  /** Where a place on the map (each axis about 0 to 1) lands on a board. */
  at(board: Board, x: number, y: number): Point {
    const across = PAD_X + x * (1 - 2 * PAD_X);
    const back = PAD_Y + y * (1 - 2 * PAD_Y);
    return [this.#left + across * this.#width + (1 - back) * this.#slant, board.top + back * board.depth];
  }

  /** A board's corners: back left, back right, front right, front left. */
  corners({ top, depth }: Board): [Point, Point, Point, Point] {
    return [
      [this.#left + this.#slant, top],
      [this.#left + this.#slant + this.#width, top],
      [this.#left + this.#width, top + depth],
      [this.#left, top + depth],
    ];
  }

  /** Where a line straight down at x first meets a board: on its back edge, or on its slanted left edge. */
  meets(board: Board, x: number): number {
    const along = (x - this.#left) / this.#slant;
    return along >= 1 ? board.top : board.top + (1 - Math.max(0, along)) * board.depth;
  }
}
