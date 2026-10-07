/**
 * How far apart two vectors are, each `dimensions` numbers long from its start in its array: 0 for
 * equal vectors, more the further apart they are. Indexes compare a query with the stored vectors
 * in place, so the vectors come as an array and a start rather than as views.
 *
 * Strategy: an index measures with whichever distance it is given.
 */
export type Distance = (a: Float32Array, aStart: number, b: Float32Array, bStart: number, dimensions: number) => number;

/** The squared Euclidean distance: it ranks vectors as the Euclidean distance does, without a square root. */
export const squaredEuclidean: Distance = (a, aStart, b, bStart, dimensions) => {
  let sum = 0;
  for (let axis = 0; axis < dimensions; axis++) {
    const difference = a[aStart + axis] - b[bStart + axis];
    sum += difference * difference;
  }
  return sum;
};
