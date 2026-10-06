import type { Career } from './career.ts';
import type { Tick } from './year-ticks.ts';

/** A rectangle in CSS pixels, from the barcode's top left. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Which way a painting's colors run along its mark: up an upright bar from the bottom, or across
 * a lying one from the left. A color strip starts at its darker end.
 */
export type Direction = 'up' | 'across';

/** A painting's place in a barcode. */
export interface Mark extends Box {
  /** Its painting's index in Career.paintings. */
  readonly painting: number;
  readonly direction: Direction;
}

/** A barcode laid out at a size: where each painting goes, and the years marked under it. */
export interface BarcodeLayout {
  readonly marks: readonly Mark[];
  readonly ticks: readonly Tick[];
  /** Shapes outlined in ink over the marks, as if cut from paper: the skyline's columns. */
  readonly outlines: readonly Box[];
}

/**
 * One way to draw an artist's career as a barcode.
 *
 * Strategy: the mockup page shows each design through the same view (see BarcodeView).
 */
export interface BarcodeDesign {
  /** The letter the mockups go by. */
  readonly letter: string;
  readonly name: string;
  /** What it shows, in a sentence. */
  readonly summary: string;
  /** Whether it lies on a card of its own, or stands its own shapes on the page. */
  readonly carded: boolean;
  /** Its height for a career at a width, in CSS pixels. */
  height(career: Career, width: number): number;
  layout(career: Career, width: number, height: number): BarcodeLayout;
}

/** A card barcode's height as a share of its width, and the least and most it may be, in CSS pixels. */
const CARD_HEIGHT = { share: 0.12, min: 96, max: 150 } as const;

/** The height of a barcode on a card, at a width: the sequence and the timeline share it, so they compare. */
export function cardHeight(width: number): number {
  return Math.round(Math.min(Math.max(width * CARD_HEIGHT.share, CARD_HEIGHT.min), CARD_HEIGHT.max));
}
