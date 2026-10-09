/** A painting's dot on a layer's board, where it is drawn on the page. */
export interface Dot {
  readonly node: number;
  readonly level: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** How near the pointer must come to a dot's edge to pick it, in CSS pixels: a mouse's, and a finger's. */
const REACH = { fine: 8, coarse: 18 } as const;
/** The side of the grid's cells, in CSS pixels: at least the farthest a dot can be picked from. */
const CELL = 34;
/** How much nearer a dot the caller prefers counts as being: it wins over its neighbors. */
const PREFERENCE = 6;

/**
 * The dots drawn on the boards, sorted into a grid of cells, so that finding the one under the
 * pointer looks at a few cells' dots rather than at all of them.
 */
export class DotHits {
  readonly #cells = new Map<string, Dot[]>();

  clear(): void {
    this.#cells.clear();
  }

  add(dot: Dot): void {
    const key = cellKey(Math.floor(dot.x / CELL), Math.floor(dot.y / CELL));
    let cell = this.#cells.get(key);
    if (!cell) this.#cells.set(key, (cell = []));
    cell.push(dot);
  }

  /**
   * The dot nearest a point, if one is near enough, preferring the paintings in `preferred` (drawn
   * larger); a coarse pointer, a finger, picks from farther than a mouse.
   */
  pick(x: number, y: number, preferred: ReadonlySet<number>, coarse = false): Dot | undefined {
    const reach = coarse ? REACH.coarse : REACH.fine;
    let best: Dot | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    const column = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const dot of this.#cells.get(cellKey(column + dx, row + dy)) ?? []) {
          const distance = Math.hypot(dot.x - x, dot.y - y);
          const favored = preferred.has(dot.node);
          const score = distance - (favored ? PREFERENCE : 0);
          if (distance <= reach + dot.radius + (favored ? PREFERENCE : 0) && score < bestScore) {
            best = dot;
            bestScore = score;
          }
        }
      }
    }
    return best;
  }
}

function cellKey(column: number, row: number): string {
  return `${column},${row}`;
}
