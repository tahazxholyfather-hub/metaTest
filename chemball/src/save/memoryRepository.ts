import { buildLeaderboard } from "./leaderboard";
import { createDefaultProfile, type LeaderboardEntry, type PlayerProfile, type RunRecord } from "./models";
import type { PlayerRepository } from "./repository";

export class MemoryPlayerRepository implements PlayerRepository {
  profile: PlayerProfile = createDefaultProfile();
  runs: RunRecord[] = [];

  async getPlayer(): Promise<PlayerProfile> {
    return structuredClone(this.profile);
  }

  async savePlayer(player: PlayerProfile): Promise<void> {
    this.profile = structuredClone(player);
  }

  async saveRun(run: RunRecord): Promise<void> {
    this.runs.push(structuredClone(run));
  }

  async getRuns(): Promise<RunRecord[]> {
    return structuredClone(this.runs);
  }

  async getBestScore(): Promise<number> {
    return this.profile.bestScore;
  }

  async getLeaderboard(player: PlayerProfile): Promise<LeaderboardEntry[]> {
    return buildLeaderboard(player);
  }
}
