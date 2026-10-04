/** Held-Karp fills a table of 2^n × n path lengths, so it stops here: 8 MB, filled in about 0.1 s. */
export const MAX_PATH_POINTS = 16;

/**
 * The order to visit points in for the shortest path through all of them, without returning to
 * the start: the traveling salesman problem as an open path, solved exactly. Palettes are small
 * enough for the Held-Karp dynamic program (1962), whose 2^n × n² steps take well under a
 * millisecond for 8 colors; heuristics such as nearest neighbor plus 2-opt are faster on many
 * points, but now and then miss the shortest path.
 *
 * The shortest path through a set of points that ends at a given point is a shortest path
 * through the rest of the set, plus one step. So the program finds the shortest paths through
 * every subset of the points, ending at each of its points, from single points up to the
 * whole set.
 */
export function shortestPath(count: number, distance: (from: number, to: number) => number): number[] {
  if (!Number.isInteger(count) || count < 0 || count > MAX_PATH_POINTS) {
    throw new RangeError(`shortestPath takes 0 to ${MAX_PATH_POINTS} points, not ${count}`);
  }
  const steps = new Float64Array(count * count);
  for (let from = 0; from < count; from++) {
    for (let to = 0; to < count; to++) steps[from * count + to] = distance(from, to);
  }
  // A subset is a bit mask: point i is in it when bit i is set. Entry subset × count + end of
  // lengths holds the length of the shortest path through exactly the subset's points that ends
  // at end; the same entry of previous holds the point before end on that path (-1 at its start).
  const subsetCount = 1 << count;
  const lengths = new Float64Array(subsetCount * count).fill(Number.POSITIVE_INFINITY);
  const previous = new Int8Array(subsetCount * count).fill(-1);
  for (let point = 0; point < count; point++) lengths[(1 << point) * count + point] = 0;
  // A subset's mask is larger than those of the subsets it extends, so counting up through the
  // masks reaches every subset after all of its paths are final.
  for (let subset = 1; subset < subsetCount; subset++) {
    for (let end = 0; end < count; end++) {
      const length = lengths[subset * count + end];
      if (length === Number.POSITIVE_INFINITY) continue; // end is not in the subset.
      for (let next = 0; next < count; next++) {
        if (subset & (1 << next)) continue;
        const entry = (subset | (1 << next)) * count + next;
        const extended = length + steps[end * count + next];
        if (extended < lengths[entry]) {
          lengths[entry] = extended;
          previous[entry] = end;
        }
      }
    }
  }
  return walkBack(lengths, previous, count);
}

/** Reads the shortest path through every point out of the table, from its best end back to its start. */
function walkBack(lengths: Float64Array, previous: Int8Array, count: number): number[] {
  let subset = (1 << count) - 1;
  let end = count > 0 ? 0 : -1;
  for (let point = 1; point < count; point++) {
    if (lengths[subset * count + point] < lengths[subset * count + end]) end = point;
  }
  const path: number[] = [];
  while (end >= 0) {
    path.push(end);
    const before = previous[subset * count + end];
    subset &= ~(1 << end);
    end = before;
  }
  return path.reverse();
}
