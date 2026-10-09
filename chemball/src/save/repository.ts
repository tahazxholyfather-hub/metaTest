import type { LeaderboardEntry, PlayerProfile, RunRecord } from "./models";

export interface PlayerRepository {
  getPlayer(): Promise<PlayerProfile>;
  savePlayer(player: PlayerProfile): Promise<void>;
  saveRun(run: RunRecord): Promise<void>;
  getRuns(): Promise<RunRecord[]>;
  getBestScore(): Promise<number>;
  getLeaderboard(player: PlayerProfile): Promise<LeaderboardEntry[]>;
}
