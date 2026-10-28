import type { RunStats } from "./types";

export function chainBonus(steps: number, combo: number): number {
  if (steps < 3) return 0;
  return 200 * combo;
}

export function xpFromStats(stats: Pick<RunStats, "score" | "reactionsCreated" | "maxCombo" | "materialsMatched">): number {
  return Math.max(
    8,
    Math.round(stats.score * 0.034 + stats.reactionsCreated * 6 + stats.materialsMatched * 4 + stats.maxCombo * 3),
  );
}

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 40)) + 1);
}

export function formatNumber(value: number): string {
  return Math.floor(value).toLocaleString("en-US");
}
