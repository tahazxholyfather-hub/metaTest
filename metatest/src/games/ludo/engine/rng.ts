/**
 * Mulberry32 — small, fast, seedable. Same seed + same call sequence => same results,
 * which is what later multiplayer lockstep needs.
 */
export class SeededRng {
  private s: number

  constructor(seed: number) {
    this.s = seed >>> 0
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = items.slice()
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      const tmp = copy[i]!
      copy[i] = copy[j]!
      copy[j] = tmp
    }
    return copy
  }
}

export function seedFrom(value?: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value >>> 0
  return ((Math.random() * 0xffffffff) >>> 0) || 1
}
