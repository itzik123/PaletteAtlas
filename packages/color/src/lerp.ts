/** The value t of the way from a to b: a at t = 0, b at t = 1. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
