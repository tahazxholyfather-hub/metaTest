import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  LEADERBOARD_LIMIT,
  parseSubmission,
  submissionScore,
  type ScoreSubmission,
} from "./scoreProof";

/**
 * Server-side leaderboard. This module reads and writes a JSON file.
 * The browser bundle must not import it.
 */

export interface StoredRecord {
  id: string;
  playerId: string;
  name: string;
  score: number;
  achievedAt: string;
  mode: "standard";
}

export interface PublicRecord {
  id: string;
  name: string;
  score: number;
  createdAt: string;
  seasonId: null;
  you: boolean;
  mode: "standard";
}

interface BoardFile {
  records: StoredRecord[];
}

interface NodeRequest {
  url?: string;
  method?: string;
  on(event: "data", listener: (chunk: Chunk) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  destroy(): void;
}

interface NodeResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

type Chunk = string | { length: number; toString(encoding: string): string };

const MAX_BODY = 96_000;
const STORES = new Map<string, ReturnType<typeof createLeaderboardStore>>();

export function leaderboardStore(filePath: string) {
  let store = STORES.get(filePath);
  if (!store) {
    store = createLeaderboardStore(filePath);
    STORES.set(filePath, store);
  }
  return store;
}

export function leaderboardPath(cwd = process.cwd()): string {
  return join(cwd, "data", "leaderboard.json");
}

export function createLeaderboardStore(filePath: string) {
  let tail: Promise<unknown> = Promise.resolve();

  const exclusive = <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const empty = (): BoardFile => ({ records: [] });

  const load = async (): Promise<{ board: BoardFile; writable: boolean }> => {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<BoardFile> | null;
      if (!parsed || !Array.isArray(parsed.records)) throw new Error("malformed");
      const records = parsed.records.filter(isStoredRecord);
      return { board: { records }, writable: true };
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code === "ENOENT") return { board: empty(), writable: true };
      try {
        await rename(filePath, `${filePath}.unreadable`);
        return { board: empty(), writable: true };
      } catch {
        return { board: empty(), writable: false };
      }
    }
  };

  const save = async (board: BoardFile): Promise<void> => {
    await mkdir(dirname(filePath), { recursive: true });
    const temp = `${filePath}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify({ records: board.records }, null, 2));
    await rename(temp, filePath);
  };

  return {
    filePath,
    async list(playerId = ""): Promise<PublicRecord[]> {
      const { board } = await exclusive(load);
      return toPublic([...board.records].sort(compareStored), playerId);
    },
    async submit(submission: ScoreSubmission, achievedAt = new Date().toISOString()): Promise<{ stored: boolean; duplicate: boolean; score: number }> {
      const score = submissionScore(submission);
      if (score === null) throw new Error("invalid-score");
      return exclusive(async () => {
        const { board, writable } = await load();
        if (!writable) throw new Error("unwritable");
        if (board.records.some((record) => record.id === submission.id)) {
          return { stored: false, duplicate: true, score };
        }
        board.records.sort(compareStored);
        if (!qualifies(board.records, score)) return { stored: false, duplicate: false, score };
        board.records.push({
          id: submission.id,
          playerId: submission.playerId,
          name: submission.name,
          score,
          achievedAt,
          mode: "standard",
        });
        board.records.sort(compareStored);
        board.records.length = Math.min(board.records.length, LEADERBOARD_LIMIT);
        await save(board);
        return { stored: true, duplicate: false, score };
      });
    },
  };
}

export async function handleLeaderboard(req: NodeRequest, res: NodeResponse, filePath: string): Promise<void> {
  const store = leaderboardStore(filePath);
  const url = new URL(req.url ?? "/api/leaderboard", "http://chemball.local");
  try {
    if (req.method === "GET") {
      const playerId = url.searchParams.get("playerId") ?? "";
      const records = await store.list(safePlayerId(playerId));
      send(res, 200, { records });
      return;
    }
    if (req.method === "POST") {
      const raw = await readBody(req);
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        send(res, 400, { error: "invalid-json" });
        return;
      }
      const parsed = parseSubmission(body);
      if (!parsed.ok) {
        send(res, 400, { error: parsed.error });
        return;
      }
      if (submissionScore(parsed.value) === null) {
        send(res, 400, { error: "invalid-score" });
        return;
      }
      const result = await store.submit(parsed.value);
      const records = await store.list(parsed.value.playerId);
      send(res, 200, { ...result, records });
      return;
    }
    send(res, 405, { error: "method" });
  } catch {
    send(res, 500, { error: "unavailable" });
  }
}

export function compareStored(a: StoredRecord, b: StoredRecord): number {
  return b.score - a.score || a.achievedAt.localeCompare(b.achievedAt) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

function qualifies(records: StoredRecord[], score: number): boolean {
  if (!Number.isSafeInteger(score) || score <= 0) return false;
  if (records.length < LEADERBOARD_LIMIT) return true;
  const lowest = records[records.length - 1];
  return Boolean(lowest) && score > lowest.score;
}

function toPublic(records: StoredRecord[], playerId: string): PublicRecord[] {
  return records.map((record) => ({
    id: record.id,
    name: record.name,
    score: record.score,
    createdAt: record.achievedAt,
    seasonId: null,
    you: playerId.length > 0 && record.playerId === playerId,
    mode: "standard",
  }));
}

function isStoredRecord(value: unknown): value is StoredRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<StoredRecord>;
  return typeof row.id === "string"
    && typeof row.playerId === "string"
    && typeof row.name === "string"
    && typeof row.score === "number"
    && Number.isFinite(row.score)
    && typeof row.achievedAt === "string"
    && row.mode === "standard";
}

function safePlayerId(value: string): string {
  return /^[A-Za-z0-9_-]{8,80}$/.test(value) ? value : "";
}

function send(res: NodeResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

async function readBody(req: NodeRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const parts: string[] = [];
    let size = 0;
    req.on("data", (chunk) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      size += text.length;
      if (size > MAX_BODY) {
        reject(new Error("too-large"));
        req.destroy();
        return;
      }
      parts.push(text);
    });
    req.on("end", () => resolve(parts.join("")));
    req.on("error", reject);
  });
}

declare const process: { cwd(): string; pid: number };
