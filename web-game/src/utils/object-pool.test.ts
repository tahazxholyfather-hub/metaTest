import { describe, expect, it } from 'vitest';
import { ObjectPool } from '@/src/utils/object-pool';

describe('ObjectPool', () => {
  it('reuses released objects and respects max', () => {
    let created = 0;
    const pool = new ObjectPool(
      () => {
        created += 1;
        return { n: created };
      },
      (item) => {
        item.n = 0;
      },
      1,
      2,
    );

    const a = pool.acquire();
    const b = pool.acquire();
    const c = pool.acquire();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(c).toBeNull();
    expect(pool.stats.active).toBe(2);

    if (a) pool.release(a);
    const d = pool.acquire();
    expect(d).toBe(a);
    expect(d?.n).toBe(0);
    expect(pool.stats.peak).toBe(2);
  });
});
