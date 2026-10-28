import { flowApi } from "../../../lib/authApi";
import { buildLeaderboard } from "./leaderboard";
import {
  createDefaultProfile,
  type LeaderboardEntry,
  type PlayerProfile,
  type RunRecord,
} from "./models";
import type { PlayerRepository } from "./repository";

interface SaveBlob {
  profile: PlayerProfile;
  runs: RunRecord[];
}

const STORAGE_KEY = "chemball-save-v1";
const DB_NAME = "chemball";
const DB_STORE = "kv";
const DB_KEY = "blob";

export class LocalPlayerRepository implements PlayerRepository {
  private lock: Promise<void> = Promise.resolve();

  async getPlayer(): Promise<PlayerProfile> {
    const blob = await this.read();
    return structuredClone(blob.profile);
  }

  async savePlayer(player: PlayerProfile): Promise<void> {
    await this.transact((blob) => {
      blob.profile = structuredClone(player);
    });
  }

  async saveRun(run: RunRecord): Promise<void> {
    await this.transact((blob) => {
      blob.runs.push(structuredClone(run));
      blob.runs = blob.runs.slice(-40);
    });
    if (run.score <= 0) return;
    const blob = await this.read();
    void flowApi.dispatch("save_chemball_score", {
      score: run.score,
      name: blob.profile.name,
    }).catch(() => undefined);
  }

  async getRuns(): Promise<RunRecord[]> {
    const blob = await this.read();
    return structuredClone(blob.runs);
  }

  async getBestScore(): Promise<number> {
    const blob = await this.read();
    return blob.profile.bestScore;
  }

  async getLeaderboard(player: PlayerProfile): Promise<LeaderboardEntry[]> {
    try {
      const res = await flowApi.dispatch("get_chemball_leaderboard") as {
        success?: boolean;
        leaders?: { id?: string; name?: string; score?: number; createdAt?: string; you?: boolean }[];
      };
      if (res?.success && Array.isArray(res.leaders)) {
        const leaders = res.leaders.map(toEntry);
        if (!leaders.some((entry) => entry.you) && player.bestScore > 0) {
          leaders.push({
            id: player.id,
            name: player.name,
            score: player.bestScore,
            createdAt: player.createdAt,
            seasonId: null,
            you: true,
          });
          leaders.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "fa"));
        }
        return leaders;
      }
    } catch {
      /* offline or signed out: keep the local board */
    }
    return buildLeaderboard(player);
  }

  private async transact(mutate: (blob: SaveBlob) => void): Promise<void> {
    const run = this.lock.then(async () => {
      const blob = await this.read();
      mutate(blob);
      await this.write(blob);
    });
    this.lock = run.then(
      () => undefined,
      () => undefined,
    );
    await run;
  }

  private async read(): Promise<SaveBlob> {
    try {
      const fromDb = await idbGet();
      if (fromDb) return fromDb;
    } catch {
      /* fall through to localStorage */
    }
    const raw = readLocal();
    if (raw) return raw;
    return { profile: createDefaultProfile(), runs: [] };
  }

  private async write(blob: SaveBlob): Promise<void> {
    writeLocal(blob);
    try {
      await idbSet(blob);
    } catch {
      /* localStorage already holds the blob */
    }
  }
}

function toEntry(row: { id?: string; name?: string; score?: number; createdAt?: string; you?: boolean }): LeaderboardEntry {
  return {
    id: String(row.id ?? ""),
    name: String(row.name || "بازیکن"),
    score: Number(row.score) || 0,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    seasonId: null,
    you: Boolean(row.you),
  };
}

function readLocal(): SaveBlob | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SaveBlob;
    if (!parsed.profile || !Array.isArray(parsed.runs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocal(blob: SaveBlob): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
}

function idbGet(): Promise<SaveBlob | null> {
  return withStore("readonly", (store) => store.get(DB_KEY)) as Promise<SaveBlob | null>;
}

function idbSet(blob: SaveBlob): Promise<void> {
  return withStore("readwrite", (store) => store.put(blob, DB_KEY)).then(() => undefined);
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(DB_STORE, mode);
      const request = fn(tx.objectStore(DB_STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    };
  });
}
