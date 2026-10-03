/** 0 = opening pace, 1 = late-run pressure. Never shown as a timer. */
export function difficultyFactor(elapsed: number, score: number): number {
  const timeCurve = 1 - Math.exp(-elapsed / 140);
  const scoreCurve = 1 - Math.exp(-score / 18000);
  return clamp(timeCurve * 0.62 + scoreCurve * 0.38, 0, 1);
}

export function fallSpeed(factor: number): number {
  return 12 + Math.pow(factor, 1.55) * 78;
}

/** Chance a new row leaves a single edge gap. The rest of the row stays intact. */
export function holeChance(factor: number): number {
  return clamp(0.08 + factor * 0.22, 0.08, 0.32);
}

export function materialChance(factor: number): number {
  return clamp((factor - 0.34) * 0.28, 0, 0.14);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
