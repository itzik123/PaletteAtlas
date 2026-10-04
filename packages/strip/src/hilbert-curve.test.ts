import { describe, expect, it } from 'vitest';
import { hilbertCurve } from './hilbert-curve.ts';

/** Every width and height up to this, so that odd and even sides meet in every combination. */
const MAX_SIDE = 32;
/** The classic curve's home: a square of 2^4 = 16 pixels a side. */
const SQUARE_ORDER = 4;

/** What is wrong with the curve through a width × height image, or undefined if nothing is. */
function curveProblem(width: number, height: number): string | undefined {
  const curve = hilbertCurve(width, height);
  const visits = new Uint8Array(width * height);
  for (const pixel of curve) visits[pixel]++;
  if (curve.length !== width * height || visits.some((count) => count !== 1)) return 'not every pixel visited once';
  let diagonalSteps = 0;
  for (let step = 1; step < curve.length; step++) {
    const dx = Math.abs((curve[step] % width) - (curve[step - 1] % width));
    const dy = Math.abs(Math.floor(curve[step] / width) - Math.floor(curve[step - 1] / width));
    if (Math.max(dx, dy) !== 1) return `step ${step} jumps`;
    if (dx === 1 && dy === 1) diagonalSteps++;
  }
  return diagonalSteps > 1 ? `${diagonalSteps} diagonal steps` : undefined;
}

describe('hilbertCurve', () => {
  it('visits every pixel once, each step to a neighbor and at most one step diagonal', () => {
    const problems: string[] = [];
    for (let width = 1; width <= MAX_SIDE; width++) {
      for (let height = 1; height <= MAX_SIDE; height++) {
        const problem = curveProblem(width, height);
        if (problem) problems.push(`${width} × ${height}: ${problem}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('fills an aligned square block with every run of 4^k pixels on a power-of-two square', () => {
    const side = 2 ** SQUARE_ORDER;
    const curve = hilbertCurve(side, side);
    const problems: string[] = [];
    for (let order = 1; order < SQUARE_ORDER; order++) {
      const blockSide = 2 ** order;
      for (let start = 0; start < curve.length; start += blockSide ** 2) {
        const run = Array.from(curve.subarray(start, start + blockSide ** 2));
        const xs = run.map((pixel) => pixel % side);
        const ys = run.map((pixel) => Math.floor(pixel / side));
        const left = Math.min(...xs);
        const top = Math.min(...ys);
        const filled = Math.max(...xs) - left + 1 === blockSide && Math.max(...ys) - top + 1 === blockSide;
        if (!filled || left % blockSide !== 0 || top % blockSide !== 0) problems.push(`run of ${run.length} from ${start}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
