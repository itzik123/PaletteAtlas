import { Srgb } from '@palette-atlas/color';

/**
 * The site's colors, the same as the tokens on :root in style.css, for what the page draws
 * itself: the veil over the picture and the images it saves.
 */
export const SITE_COLORS = {
  paper: '#f7f1e6',
  ink: '#18140f',
  red: '#f2452f',
  yellow: '#ffc81f',
  green: '#1fae74',
  blue: '#2f55e4',
  pink: '#ff9cc6',
} as const;

/** The site's five bold colors, in the order of its logo's bands. */
export const LOGO_COLORS = [SITE_COLORS.red, SITE_COLORS.yellow, SITE_COLORS.green, SITE_COLORS.blue, SITE_COLORS.pink];

/** A site color as the color library sees it. */
export function siteSrgb(name: keyof typeof SITE_COLORS): Srgb {
  const hex = SITE_COLORS[name];
  const byte = (start: number): number => Number.parseInt(hex.slice(start, start + 2), 16);
  return Srgb.fromBytes(byte(1), byte(3), byte(5));
}
