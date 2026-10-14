export interface PoolStats {
  size: number;
  active: number;
  free: number;
  peak: number;
  max: number;
}

export class ObjectPool<T> {
  private readonly free: T[] = [];
  private readonly live = new Set<T>();
  private peak = 0;

  constructor(
    private readonly create: () => T,
    private readonly reset: (item: T) => void,
    initial: number,
    private readonly max: number,
  ) {
    const count = Math.min(initial, max);
    for (let i = 0; i < count; i += 1) this.free.push(create());
  }

  acquire(): T | null {
    if (this.free.length === 0) {
      if (this.live.size >= this.max) return null;
      this.free.push(this.create());
    }
    const item = this.free.pop();
    if (!item) return null;
    this.live.add(item);
    this.peak = Math.max(this.peak, this.live.size);
    return item;
  }

  release(item: T): void {
    if (!this.live.has(item)) return;
    this.reset(item);
    this.live.delete(item);
    this.free.push(item);
  }

  get stats(): PoolStats {
    return {
      size: this.live.size + this.free.length,
      active: this.live.size,
      free: this.free.length,
      peak: this.peak,
      max: this.max,
    };
  }
}
