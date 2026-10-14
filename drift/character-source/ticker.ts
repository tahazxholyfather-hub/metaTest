type Tick = (dt: number) => void

const subscribers = new Set<Tick>()
let rafId = 0
let last = 0

const MAX_DT = 1 / 20

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, MAX_DT)
  last = now
  for (const fn of subscribers) fn(dt)
  rafId = subscribers.size > 0 ? requestAnimationFrame(frame) : 0
}

/**
 * One shared requestAnimationFrame loop for every character on the page.
 * Returns an unsubscribe function.
 */
export function subscribe(fn: Tick): () => void {
  subscribers.add(fn)
  if (!rafId) {
    last = performance.now()
    rafId = requestAnimationFrame(frame)
  }
  return () => {
    subscribers.delete(fn)
    if (subscribers.size === 0 && rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }
}
