/** A year marked under a career barcode, where its paintings begin. */
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
 * The years to mark under a barcode `width` pixels wide whose bars, one per painting, share its
 * width equally, the paintings' years given in order: the first year, then a year every step,
 * each marked where its paintings begin.
 */
export function yearTicks(years: readonly number[], width: number): Tick[] {
  const first = years[0];
  const last = years.at(-1);
  if (first === undefined || last === undefined) return [];
  const barWidth = width / years.length;
  // The step is taken as if every year had the same room: the room they have on average.
  const yearWidth = width / (last + 1 - first);
  const step = YEAR_STEPS.find((candidate) => candidate * yearWidth >= MIN_SPACING) ?? YEAR_STEPS[YEAR_STEPS.length - 1];
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

/** The ticks whose labels fit: each far enough from the one kept before it, and from the right edge. */
function apart(ticks: readonly Tick[], width: number): Tick[] {
  const kept: Tick[] = [];
  for (const tick of ticks) {
    const before = kept.at(-1);
    if (tick.x <= width - LABEL_WIDTH && (before === undefined || tick.x - before.x >= MIN_SPACING)) kept.push(tick);
  }
  return kept;
}
