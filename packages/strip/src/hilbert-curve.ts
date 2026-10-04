/** A rectangle longer than this, side to side, is cut in two along its length instead. */
const LONG_RATIO = 3 / 2;

/** Receives the pixels of the curve, one at a time, in order. */
type Visit = (x: number, y: number) => void;

/**
 * The pixels of a width × height image in the order of a Hilbert curve, as indices y × width + x.
 * The curve passes through every pixel, each step to a neighbor, and keeps pixels that are close
 * along it close in the image, so every run of it covers a compact patch. The classic curve fills
 * a square whose side is a power of 2; this is Jakub Červený's generalization to any rectangle
 * ("gilbert", 2018: https://github.com/jakubcerveny/gilbert), which matches the classic curve on
 * such squares. Where the longer side is odd and the shorter even, one step may be diagonal.
 *
 * The curve starts at the top-left corner and runs along the longer side.
 */
export function hilbertCurve(width: number, height: number): Uint32Array {
  const curve = new Uint32Array(width * height);
  let next = 0;
  const visit: Visit = (x, y) => {
    curve[next++] = y * width + x;
  };
  if (width >= height) fill(0, 0, width, 0, 0, height, visit);
  else fill(0, 0, 0, height, width, 0, visit);
  return curve;
}

/**
 * Visits the pixels of the rectangle with corner (x, y) and sides (ax, ay) and (bx, by), each
 * along an axis and pointing either way: the curve enters at the corner and leaves at the far
 * end of side a, which it runs along. Each part is filled the same way, recursively.
 */
function fill(x: number, y: number, ax: number, ay: number, bx: number, by: number, visit: Visit): void {
  const length = Math.abs(ax + ay);
  const breadth = Math.abs(bx + by);
  // One pixel along each side.
  const stepAx = Math.sign(ax);
  const stepAy = Math.sign(ay);
  const stepBx = Math.sign(bx);
  const stepBy = Math.sign(by);
  if (breadth === 1) return line(x, y, stepAx, stepAy, length, visit);
  if (length === 1) return line(x, y, stepBx, stepBy, breadth, visit);

  let halfAx = Math.floor(ax / 2);
  let halfAy = Math.floor(ay / 2);
  let halfBx = Math.floor(bx / 2);
  let halfBy = Math.floor(by / 2);
  if (length > LONG_RATIO * breadth) {
    // A long rectangle: two parts, one after the other along a. An even first part lets the
    // curve leave it right beside where the second part starts.
    if (Math.abs(halfAx + halfAy) % 2 === 1 && length > 2) {
      halfAx += stepAx;
      halfAy += stepAy;
    }
    fill(x, y, halfAx, halfAy, bx, by, visit);
    fill(x + halfAx, y + halfAy, ax - halfAx, ay - halfAy, bx, by, visit);
    return;
  }
  // The classic three parts: up the first half of b, across along a, and back down the far side.
  if (Math.abs(halfBx + halfBy) % 2 === 1 && breadth > 2) {
    halfBx += stepBx;
    halfBy += stepBy;
  }
  fill(x, y, halfBx, halfBy, halfAx, halfAy, visit);
  fill(x + halfBx, y + halfBy, ax, ay, bx - halfBx, by - halfBy, visit);
  fill(
    x + (ax - stepAx) + (halfBx - stepBx),
    y + (ay - stepAy) + (halfBy - stepBy),
    -halfBx,
    -halfBy,
    -(ax - halfAx),
    -(ay - halfAy),
    visit,
  );
}

/** Visits count pixels in a straight line from (x, y), one step of (dx, dy) apart. */
function line(x: number, y: number, dx: number, dy: number, count: number, visit: Visit): void {
  for (let pixel = 0; pixel < count; pixel++) visit(x + pixel * dx, y + pixel * dy);
}
