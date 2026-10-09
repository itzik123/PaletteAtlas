/** Room to leave at the end of each row, so that rounding never pushes its last item onto the next. */
export const ROUNDING_ROOM = 1;

/** One row of a justified layout: items start to end (exclusive), with their pictures this tall. */
export interface Row {
  readonly start: number;
  readonly end: number;
  readonly height: number;
  /** Whether the row fills the width: all but a last row that ran out of pictures do. */
  readonly full: boolean;
}

export interface RowsOptions {
  /** The width the rows fill. */
  readonly width: number;
  /** The height rows aim for. */
  readonly height: number;
  /** The space between items. */
  readonly gap: number;
  /** The width each item adds to its picture's (its border, say). */
  readonly extra: number;
}

/**
 * Lays pictures out in justified rows, by their aspect ratios (width / height): each row takes
 * pictures while they fit at about the target height, then scales to fill the width exactly.
 * The last row, if not full, stays at the target height.
 */
export function justifiedRows(aspects: readonly number[], { width, height, gap, extra }: RowsOptions): Row[] {
  const rows: Row[] = [];
  let start = 0;
  let aspectSum = 0;
  aspects.forEach((aspect, index) => {
    aspectSum += aspect;
    const count = index + 1 - start;
    const fixed = count * extra + (count - 1) * gap;
    if (aspectSum * height + fixed >= width) {
      rows.push({ start, end: index + 1, height: (width - fixed) / aspectSum, full: true });
      start = index + 1;
      aspectSum = 0;
    }
  });
  if (start < aspects.length) rows.push({ start, end: aspects.length, height, full: false });
  return rows;
}
