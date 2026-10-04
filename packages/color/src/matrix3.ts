export type Vector3 = readonly [number, number, number];
export type Matrix3 = readonly [Vector3, Vector3, Vector3];

export function multiply([row0, row1, row2]: Matrix3, vector: Vector3): Vector3 {
  return [dot(row0, vector), dot(row1, vector), dot(row2, vector)];
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

function dot([a0, a1, a2]: Vector3, [b0, b1, b2]: Vector3): number {
  return a0 * b0 + a1 * b1 + a2 * b2;
}

function scale([x, y, z]: Vector3, factor: number): Vector3 {
  return [x * factor, y * factor, z * factor];
}
