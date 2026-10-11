import type { SearchStep } from '@palette-atlas/hnsw';

/** How long the replay spends, in milliseconds, on each layer above the bottom one, on the bottom one, and on each way down. */
export interface ReplayTimes {
  readonly upper: number;
  readonly bottom: number;
  readonly pause: number;
}

/**
 * The upper layers hold a few paintings, where a search takes a few dozen steps; the bottom one
 * holds them all, where it takes thousands. Each upper layer gets as long as the next, so their
 * steps can be followed one by one, and the bottom one long enough to watch the search close in.
 */
const TIMES: ReplayTimes = { upper: 1300, bottom: 7000, pause: 350 };

/** A layer's part of the replay: its steps, from and up to (not including), and its time. */
export interface ClockSegment {
  readonly level: number;
  readonly from: number;
  readonly to: number;
  readonly start: number;
  readonly end: number;
}

/** The replay's clock: which of a search's steps it shows at each moment. */
export class ReplayClock {
  /** Each layer's part, the top one first. */
  readonly segments: readonly ClockSegment[];
  /** How long the whole replay lasts, in milliseconds. */
  readonly duration: number;

  constructor(steps: readonly SearchStep[], times: ReplayTimes = TIMES) {
    const starts = steps.flatMap((step, index) => (step.kind === 'layer' ? [{ level: step.level, from: index }] : []));
    const segments: ClockSegment[] = [];
    let time = 0;
    starts.forEach(({ level, from }, part) => {
      const end = time + (level === 0 ? times.bottom : times.upper);
      segments.push({ level, from, to: starts[part + 1]?.from ?? steps.length, start: time, end });
      time = end + times.pause;
    });
    this.segments = segments;
    this.duration = segments.at(-1)?.end ?? 0;
  }

  /** How many of the steps the replay shows at a moment, from 0 to its duration: a layer's steps at an even pace through its time. */
  stepAt(time: number): number {
    let shown = 0;
    for (const { from, to, start, end } of this.segments) {
      if (time < start) break;
      shown = from + Math.round((to - from) * Math.min(1, (time - start) / Math.max(1, end - start)));
    }
    return shown;
  }

  /** The layer the replay shows at a moment: the last whose part has begun, or none before any. */
  levelAt(time: number): number | undefined {
    return this.segments.findLast(({ start }) => start <= time)?.level;
  }
}
