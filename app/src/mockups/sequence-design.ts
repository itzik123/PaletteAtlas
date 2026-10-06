import { type BarcodeDesign, type BarcodeLayout, cardHeight, type Mark } from './barcode-design.ts';
import type { Career } from './career.ts';
import { sequenceTicks } from './year-ticks.ts';

/**
 * Every painting a bar of the same width, oldest first, like a film's frames in a movie barcode:
 * the years an artist painted most take the most room, and the years are marked where their
 * paintings begin.
 */
export class SequenceDesign implements BarcodeDesign {
  readonly letter = 'A';
  readonly name = 'Sequence';
  readonly summary = 'Every painting one bar, oldest first: the busiest years take the most room.';
  readonly carded = true;

  height(_career: Career, width: number): number {
    return cardHeight(width);
  }

  layout(career: Career, width: number, height: number): BarcodeLayout {
    const barWidth = width / career.paintings.length;
    const marks = career.paintings.map(
      (_, painting): Mark => ({ painting, x: painting * barWidth, y: 0, width: barWidth, height, direction: 'up' }),
    );
    const years = career.paintings.map(({ year }) => year);
    return { marks, ticks: sequenceTicks(years, barWidth, width), outlines: [] };
  }
}
