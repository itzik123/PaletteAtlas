import type { SearchStep } from '@palette-atlas/hnsw';
import { describe, expect, it } from 'vitest';
import { ReplayClock } from './replay-clock.ts';

const TIMES = { upper: 1000, bottom: 5000, pause: 200 } as const;

/** A record that spends some steps on each layer, the top one first. */
function record(stepsByLayer: readonly number[]): SearchStep[] {
  return stepsByLayer.flatMap((count, layer) => [
    { kind: 'layer', level: stepsByLayer.length - 1 - layer } as const,
    ...Array.from({ length: count }, (_, node) => ({ kind: 'measure', node, distance: node }) as const),
  ]);
}

describe('ReplayClock', () => {
  it('gives each upper layer the same time, the bottom one longer, with a pause on each way down', () => {
    const clock = new ReplayClock(record([3, 8, 120]), TIMES);
    expect(clock.segments.map(({ level, start, end }) => [level, start, end])).toEqual([
      [2, 0, 1000],
      [1, 1200, 2200],
      [0, 2400, 7400],
    ]);
    expect(clock.duration).toBe(7400);
  });

  it('shows every step by its end, and never takes one back', () => {
    const steps = record([3, 8, 120]);
    const clock = new ReplayClock(steps, TIMES);
    let before = 0;
    for (let time = 0; time <= clock.duration; time += 50) {
      const shown = clock.stepAt(time);
      expect(shown).toBeGreaterThanOrEqual(before);
      before = shown;
    }
    expect(clock.stepAt(clock.duration)).toBe(steps.length);
    expect(new ReplayClock([], TIMES).duration).toBe(0);
  });
});
