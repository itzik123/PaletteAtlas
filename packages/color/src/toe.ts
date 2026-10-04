// Björn Ottosson's toe, from "Two new color spaces for color picking: Okhsv and Okhsl" (2021):
// https://bottosson.github.io/posts/colorpicker/

const K1 = 0.206;
const K2 = 0.03;
/** Chosen so that the toe keeps 1 at 1. */
const K3 = (1 + K1) / (1 + K2);

/**
 * Ottosson's toe-corrected lightness L_r for an OKLab lightness L. OKLab's cube root rises
 * steeply near black, so it sets the darkest shades further apart than they look on a screen;
 * the toe flattens that stretch to follow CIELab lightness, and leaves 0 and 1 in place.
 */
export function toe(lightness: number): number {
  const shifted = K3 * lightness - K1;
  return (shifted + Math.sqrt(shifted * shifted + 4 * K2 * K3 * lightness)) / 2;
}

/** The OKLab lightness for a toe-corrected lightness: the inverse of toe. */
export function toeInverse(toeLightness: number): number {
  return (toeLightness * (toeLightness + K1)) / (K3 * (toeLightness + K2));
}
