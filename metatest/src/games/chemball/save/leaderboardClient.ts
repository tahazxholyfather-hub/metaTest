import type { LeaderboardEntry } from "./models";
import type { ScoreSubmission } from "./scoreProof";

export function compareLeaderboard(a: LeaderboardEntry, b: LeaderboardEntry): number {
  return b.score - a.score || a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

/** Accepts a server payload and drops malformed rows so the UI cannot crash on bad JSON. */
export function normalizeLeaderboard(payload: unknown): LeaderboardEntry[] {
  const records = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { records?: unknown }).records)
      ? (payload as { records: unknown[] }).records
      : [];
  const entries: LeaderboardEntry[] = [];
  for (const item of records) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.name !== "string") continue;
    if (typeof row.score !== "number" || !Number.isFinite(row.score)) continue;
    entries.push({
      id: row.id,
      name: row.name,
      score: Math.floor(row.score),
      createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
      seasonId: null,
      you: row.you === true,
    });
  }
  return entries.sort(compareLeaderboard);
}

export async function fetchLeaderboard(playerId: string): Promise<LeaderboardEntry[]> {
  const response = await fetch(`/api/chemball/leaderboard?playerId=${encodeURIComponent(playerId)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("leaderboard unavailable");
  return normalizeLeaderboard(await response.json());
}

export async function submitLeaderboard(submission: ScoreSubmission): Promise<void> {
  const response = await fetch("/api/chemball/leaderboard", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(submission),
  });
  if (!response.ok) throw new Error("leaderboard rejected");
}
