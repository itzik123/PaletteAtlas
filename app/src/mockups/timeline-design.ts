import { type BarcodeDesign, type BarcodeLayout, cardHeight, type Mark } from './barcode-design.ts';
import type { Career } from './career.ts';
import { evenTicks } from './year-ticks.ts';

/**
 * The years to scale, from the first painting to the last, each year's paintings sharing its
 * room side by side: a year without a painting is a gap, and a busy year's bars are thin.
 */
export class TimelineDesign implements BarcodeDesign {
  readonly letter = 'B';
  readonly name = 'Timeline';
  readonly summary = 'The years to scale: each year’s paintings share its room, and a year without any is a gap.';
  readonly carded = true;

  height(_career: Career, width: number): number {
    return cardHeight(width);
  }

  layout(career: Career, width: number, height: number): BarcodeLayout {
    const end = career.last + 1;
    const yearWidth = width / (end - career.first);
    const marks: Mark[] = [];
    for (const { year, start, end: stop } of career.spans(1)) {
      const barWidth = yearWidth / (stop - start);
      const left = (year - career.first) * yearWidth;
      for (let painting = start; painting < stop; painting++) {
        marks.push({ painting, x: left + (painting - start) * barWidth, y: 0, width: barWidth, height, direction: 'up' });
      }
    }
    return { marks, ticks: evenTicks(career.first, end, yearWidth, width), outlines: [] };
  }
}
