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
  const settled = 4.2 + Math.pow(factor, 1.45) * 96;
  const wake = clamp((elapsed - 5) / 18, 0, 1);
  return settled * (0.08 + 0.92 * wake);
}

export function holeChance(factor: number): number {
  return clamp(0.46 - factor * 0.34, 0.08, 0.5);
}

export function materialChance(factor: number): number {
  return clamp((factor - 0.18) * 0.22, 0, 0.16);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
