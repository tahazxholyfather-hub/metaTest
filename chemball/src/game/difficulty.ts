/** 0 = opening pace, 1 = late-run pressure. Never shown as a timer. */
export function difficultyFactor(elapsed: number, score: number): number {
  const timeCurve = 1 - Math.exp(-Math.max(0, elapsed - 8) / 170);
  const scoreCurve = 1 - Math.exp(-score / 18000);
  return clamp(timeCurve * 0.62 + scoreCurve * 0.5, 0, 1);
}

/**
 * Opening seconds barely move. The settled early pace is about one row
 * every ten seconds; pressure only climbs once the run is underway.
 * `elapsed` defaults to a settled run so callers that omit it see the awake speed.
 */
export function fallSpeed(factor: number, elapsed = 10_000): number {
  const settled = 3.2 + Math.pow(factor, 1.6) * 84;
  const wake = clamp((elapsed - 14) / 32, 0, 1);
  return settled * (0.05 + 0.95 * wake);
}

export function holeChance(factor: number): number {
  return clamp(0.58 - factor * 0.36, 0.14, 0.62);
}

export function materialChance(factor: number): number {
  return factor < 0 ? 0 : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
