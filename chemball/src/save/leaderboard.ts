import type { LeaderboardEntry, PlayerProfile } from "./models";

const SEED: LeaderboardEntry[] = [
  { id: "seed-nova", name: "نیلوفر", score: 48920, createdAt: "2026-01-04T00:00:00.000Z", seasonId: null, you: false },
  { id: "seed-irid", name: "آرش", score: 42180, createdAt: "2026-01-06T00:00:00.000Z", seasonId: null, you: false },
  { id: "seed-quill", name: "سارا", score: 39740, createdAt: "2026-01-08T00:00:00.000Z", seasonId: null, you: false },
  { id: "seed-sable", name: "کیان", score: 28410, createdAt: "2026-02-02T00:00:00.000Z", seasonId: null, you: false },
  { id: "seed-hex", name: "مهسا", score: 22100, createdAt: "2026-02-11T00:00:00.000Z", seasonId: null, you: false },
];

export function buildLeaderboard(player: PlayerProfile): LeaderboardEntry[] {
  const mine: LeaderboardEntry = {
    id: player.id,
    name: player.name,
    score: player.bestScore,
    createdAt: player.createdAt,
    seasonId: null,
    you: true,
  };
  return [...SEED, mine].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
