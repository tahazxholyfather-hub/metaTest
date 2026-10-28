/**
 * Prototype aggregates. A future API can split these into:
 * users(id, username, avatar, created_at)
 * player_profiles(user_id, xp, level, best_score, total_runs, total_score)
 * game_runs(id, user_id, score, xp, max_combo, reaction_count, material_match_count, chain_count, created_at)
 * leaderboard_scores(id, user_id, score, created_at, season_id)
 * player_reactions(user_id, reaction_id, discovered_at)
 * player_materials(user_id, material_id, unlocked_at)
 * player_achievements(user_id, achievement_id, unlocked_at)
 *
 * Score ranks the leaderboard. XP is account progression only.
 */

export interface PlayerProfile {
  id: string;
  name: string;
  avatar: string;
  xp: number;
  level: number;
  totalRuns: number;
  bestScore: number;
  totalScore: number;
  discoveredReactions: string[];
  unlockedMaterials: string[];
  sound: boolean;
  hintSeen: boolean;
  createdAt: string;
}

export interface RunRecord {
  id: string;
  score: number;
  xpEarned: number;
  maxCombo: number;
  reactionsCreated: number;
  materialsMatched: number;
  chainCount: number;
  objectsDestroyed: number;
  highestChain: number;
  duration: number;
  createdAt: string;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  createdAt: string;
  seasonId: string | null;
  you: boolean;
}

export interface UserRecord {
  id: string;
  username: string;
  avatar: string;
  createdAt: string;
}

export interface PlayerProfileRecord {
  userId: string;
  xp: number;
  level: number;
  bestScore: number;
  totalRuns: number;
  totalScore: number;
}

export interface GameRunRecord {
  id: string;
  userId: string;
  score: number;
  xp: number;
  maxCombo: number;
  reactionCount: number;
  materialMatchCount: number;
  chainCount: number;
  createdAt: string;
}

export interface LeaderboardScoreRecord {
  id: string;
  userId: string;
  score: number;
  createdAt: string;
  seasonId: string | null;
}

export function createDefaultProfile(): PlayerProfile {
  const id = globalThis.crypto?.randomUUID?.() ?? `player-${Date.now()}`;
  return {
    id,
    name: "رضا",
    avatar: "ر",
    xp: 0,
    level: 1,
    totalRuns: 0,
    bestScore: 0,
    totalScore: 0,
    discoveredReactions: [],
    unlockedMaterials: [],
    sound: true,
    hintSeen: false,
    createdAt: new Date().toISOString(),
  };
}

export function toUserRecord(profile: PlayerProfile): UserRecord {
  return { id: profile.id, username: profile.name, avatar: profile.avatar, createdAt: profile.createdAt };
}

export function toProfileRecord(profile: PlayerProfile): PlayerProfileRecord {
  return {
    userId: profile.id,
    xp: profile.xp,
    level: profile.level,
    bestScore: profile.bestScore,
    totalRuns: profile.totalRuns,
    totalScore: profile.totalScore,
  };
}

export function toGameRunRecord(userId: string, run: RunRecord): GameRunRecord {
  return {
    id: run.id,
    userId,
    score: run.score,
    xp: run.xpEarned,
    maxCombo: run.maxCombo,
    reactionCount: run.reactionsCreated,
    materialMatchCount: run.materialsMatched,
    chainCount: run.chainCount,
    createdAt: run.createdAt,
  };
}
