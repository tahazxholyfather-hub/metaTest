export function isPhonePortrait(): boolean {
  const touch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
  if (!touch) return false
  const portrait = window.innerHeight > window.innerWidth + 24
  return portrait && Math.min(window.innerWidth, window.innerHeight) < 900
}

export function wantsTouch(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches
}

export function tryLockLandscape(): void {
  if (!wantsTouch()) return
  const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> }
  if (!orientation?.lock) return
  void orientation.lock('landscape').catch(() => undefined)
}
