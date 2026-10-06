import type { BarcodeDesign, BarcodeLayout, Box, Mark } from './barcode-design.ts';
import type { Career, Span } from './career.ts';
import { evenTicks } from './year-ticks.ts';

/**
 * The most it may be tall as a share of its width, and the least and most that may be, in CSS
 * pixels: its columns need more than the cards.
 */
const HEIGHT = { share: 0.2, min: 160, max: 240 } as const;
/** The spans of years a column may stand for: the shortest that gives each column MIN_COLUMN_ROOM is taken. */
const SPAN_YEARS = [1, 2, 5, 10, 20, 50] as const;
/** The least and most room a column takes, its share of the gaps included, in CSS pixels. */
const MIN_COLUMN_ROOM = 40;
const MAX_COLUMN_ROOM = 120;
/** The space between two columns, in CSS pixels: room for their outlines and shadows. */
const COLUMN_GAP = 14;
/**
 * The thickest a painting's layer may be, in CSS pixels, so that a handful of paintings don't
 * make giant blocks: a small oeuvre makes a low skyline.
 */
const MAX_LAYER_HEIGHT = 28;

/**
 * The years to scale, each span of years a column piled with its paintings, oldest at the
 * bottom like layers of rock: the taller the column, the more the artist painted then. Each
 * painting lies across its column, its colors running from the left.
 */
export class SkylineDesign implements BarcodeDesign {
  readonly letter = 'C';
  readonly name = 'Skyline';
  readonly summary = 'The years to scale, each column a pile of its paintings: the taller, the more they painted.';
  readonly carded = false;

  height(career: Career, width: number): number {
    const highest = Math.min(Math.max(width * HEIGHT.share, HEIGHT.min), HEIGHT.max);
    return Math.round(Math.min(highest, piles(career, width).tallest * MAX_LAYER_HEIGHT));
  }

  layout(career: Career, width: number, height: number): BarcodeLayout {
    const { years, start, end, spans, tallest } = piles(career, width);
    const yearWidth = Math.min(width / (end - start), MAX_COLUMN_ROOM / years);
    const layerHeight = height / tallest;
    const marks: Mark[] = [];
    const outlines: Box[] = [];
    for (const span of spans) {
      // Whole pixels, so that the column's outline meets its paintings exactly.
      const x = Math.round((span.year - start) * yearWidth + COLUMN_GAP / 2);
      const columnWidth = Math.round((span.year + years - start) * yearWidth - COLUMN_GAP / 2) - x;
      for (let painting = span.start; painting < span.end; painting++) {
        const y = height - (painting - span.start + 1) * layerHeight;
        marks.push({ painting, x, y, width: columnWidth, height: layerHeight, direction: 'across' });
      }
      const pile = (span.end - span.start) * layerHeight;
      outlines.push({ x, y: height - pile, width: columnWidth, height: pile });
    }
    return { marks, ticks: evenTicks(start, end, yearWidth, width, years), outlines };
  }
}

/** A career's paintings piled in columns. */
interface Piles {
  /** The years each column stands for. */
  readonly years: number;
  /** The years the columns span, from the first one's start up to the last one's end (exclusive). */
  readonly start: number;
  readonly end: number;
  /** The columns' paintings, column by column; only the columns with any. */
  readonly spans: readonly Span[];
  /** The most paintings a column has. */
  readonly tallest: number;
}

/** A career's paintings piled at a width: in columns of the fewest years that leave each column room enough. */
function piles(career: Career, width: number): Piles {
  const years = SPAN_YEARS.find((span) => (span * width) / axisYears(career, span) >= MIN_COLUMN_ROOM) ?? SPAN_YEARS[SPAN_YEARS.length - 1];
  const start = Math.floor(career.first / years) * years;
  const spans = career.spans(years);
  return {
    years,
    start,
    end: start + axisYears(career, years),
    spans,
    tallest: Math.max(1, ...spans.map((span) => span.end - span.start)),
  };
}

/** How many years the columns span, from the start of the first one to the end of the last. */
function axisYears(career: Career, years: number): number {
  return (Math.floor(career.last / years) + 1 - Math.floor(career.first / years)) * years;
}
