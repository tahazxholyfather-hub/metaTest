/** 0 = opening pace, 1 = late-run pressure. Never shown as a timer. */
export function difficultyFactor(elapsed: number, score: number): number {
  const timeCurve = 1 - Math.exp(-elapsed / 78);
  const scoreCurve = 1 - Math.exp(-score / 14000);
  return clamp(timeCurve * 0.72 + scoreCurve * 0.48, 0, 1);
}

export function fallSpeed(factor: number): number {
  return 13 + Math.pow(factor, 1.32) * 92;
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
