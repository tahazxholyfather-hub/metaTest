import { describe, expect, it } from 'vitest';
import { approach, clamp, distance, lerp } from '@/src/utils/math-utils';

describe('math-utils', () => {
  it('clamps values', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });

  it('lerps and approaches', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(approach(0, 10, 4)).toBe(4);
    expect(approach(10, 0, 3)).toBe(7);
  });

  it('measures distance', () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
  });
});
