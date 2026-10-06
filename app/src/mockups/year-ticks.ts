/** A year marked under a barcode, where its paintings begin. */
export interface Tick {
  /** Its distance from the barcode's left edge, in CSS pixels. */
  readonly x: number;
  readonly year: number;
}

/** Steps between marked years: the smallest that keeps their labels apart is taken. */
const YEAR_STEPS = [1, 2, 5, 10, 20, 25, 50, 100] as const;
/** The least room from one marked year to the next, in CSS pixels: a label's width and some air. */
const MIN_SPACING = 64;
/** The room a label takes right of its mark: no year is marked closer than this to the right edge. */
const LABEL_WIDTH = 44;

/**
 * The years to mark under a barcode `width` pixels wide where every year takes the same room,
 * `yearWidth` pixels, from `first` up to `end` (exclusive): the first year, then a year every
 * step, the step a multiple of `multipleOf`.
 */
export function evenTicks(first: number, end: number, yearWidth: number, width: number, multipleOf = 1): Tick[] {
  const step = stepFor(yearWidth, multipleOf);
  const ticks: Tick[] = [{ x: 0, year: first }];
  for (let year = Math.ceil(first / step) * step; year < end; year += step) ticks.push({ x: (year - first) * yearWidth, year });
  return apart(ticks, width);
}

/**
 * The years to mark under a barcode `width` pixels wide whose paintings are bars `barWidth`
 * pixels wide, their years in order: the first year, then a year every step, each marked where
 * its paintings begin.
 */
export function sequenceTicks(years: readonly number[], barWidth: number, width: number): Tick[] {
  const first = years[0];
  const last = years.at(-1);
  if (first === undefined || last === undefined) return [];
  // The step is taken as if every year had the same room: the room they have on average.
  const step = stepFor(width / (last + 1 - first), 1);
  const ticks: Tick[] = [{ x: 0, year: first }];
  let index = 0;
  for (let year = Math.ceil(first / step) * step; year <= last; year += step) {
    while (years[index] < year) index++;
    const x = index * barWidth;
    // Years without paintings meet where the next painting begins: the latest of them names it.
    if (ticks.at(-1)?.x === x) ticks.pop();
    ticks.push({ x, year });
  }
  return apart(ticks, width);
}

/** The smallest step, a multiple of `multipleOf`, that keeps marked years MIN_SPACING apart. */
function stepFor(yearWidth: number, multipleOf: number): number {
  const steps = YEAR_STEPS.filter((step) => step % multipleOf === 0);
  return steps.find((step) => step * yearWidth >= MIN_SPACING) ?? steps.at(-1) ?? multipleOf;
}

/** The ticks whose labels fit: each far enough from the one kept before it, and from the right edge. */
function apart(ticks: readonly Tick[], width: number): Tick[] {
  const kept: Tick[] = [];
  for (const tick of ticks) {
    const before = kept.at(-1);
    if (tick.x <= width - LABEL_WIDTH && (before === undefined || tick.x - before.x >= MIN_SPACING)) kept.push(tick);
  }
  return kept;
}
