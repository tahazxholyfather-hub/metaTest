import { describe, expect, it } from 'vitest';
import { Timer } from '@/src/utils/timer';

describe('Timer', () => {
  it('fires once unless repeating', () => {
    const once = new Timer(100);
    expect(once.update(40)).toBe(false);
    expect(once.update(70)).toBe(true);
    expect(once.update(50)).toBe(false);

    const loop = new Timer(100, true);
    expect(loop.update(100)).toBe(true);
    expect(loop.update(100)).toBe(true);
  });
});
