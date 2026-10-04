export type Vector3 = readonly [number, number, number];
export type Matrix3 = readonly [Vector3, Vector3, Vector3];

/**
 * Writes matrix × (x, y, z) into out[0..2] without allocating, for pixel loops. The inputs are
 * read before out is written, so they may come from out itself.
 */
export function transform(matrix: Matrix3, x: number, y: number, z: number, out: Float64Array): void {
  const row0 = matrix[0];
  const row1 = matrix[1];
  const row2 = matrix[2];
  out[0] = row0[0] * x + row0[1] * y + row0[2] * z;
  out[1] = row1[0] * x + row1[1] * y + row1[2] * z;
  out[2] = row2[0] * x + row2[1] * y + row2[2] * z;
}

/** The inverse of an invertible matrix, from its cofactors. */
export function invert([[a, b, c], [d, e, f], [g, h, i]]: Matrix3): Matrix3 {
  // The adjugate: the matrix of cofactors, transposed.
  const [row0, row1, row2]: Matrix3 = [
    [e * i - f * h, c * h - b * i, b * f - c * e],
    [f * g - d * i, a * i - c * g, c * d - a * f],
    [d * h - e * g, b * g - a * h, a * e - b * d],
  ];
  const inverseDeterminant = 1 / (a * row0[0] + b * row1[0] + c * row2[0]);
  return [
    scale(row0, inverseDeterminant),
    scale(row1, inverseDeterminant),
    scale(row2, inverseDeterminant),
  ];
}

function scale([x, y, z]: Vector3, factor: number): Vector3 {
  return [x * factor, y * factor, z * factor];
}
