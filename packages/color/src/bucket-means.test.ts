import { describe, expect, it } from 'vitest';
import { BucketMeans } from './index.ts';

const OPAQUE = 255;
const TRANSPARENT = 0;

describe('BucketMeans', () => {
  it('averages each bucket in linear light, weighting colors by opacity', () => {
    const means = new BucketMeans(3);
    means.add(0, 0, 0, 0, OPAQUE);
    means.add(0, 255, 255, 255, OPAQUE);
    means.add(1, 255, 0, 0, OPAQUE);
    means.add(1, 0, 0, 255, TRANSPARENT);
    // Black and white blend to #bcbcbc; the hidden blue adds no color, only half the coverage;
    // the third bucket got nothing and stays transparent.
    expect(Array.from(means.toImage().data)).toEqual([188, 188, 188, 255, 255, 0, 0, 128, 0, 0, 0, 0]);
  });
});
