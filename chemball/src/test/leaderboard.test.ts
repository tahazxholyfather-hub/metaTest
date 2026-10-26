import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createLeaderboardStore, handleLeaderboard, type StoredRecord } from "../save/leaderboardApi";
import { normalizeLeaderboard } from "../save/leaderboardClient";
import { parseSubmission, submissionScore, type ScoreSubmission } from "../save/scoreProof";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("leaderboard json store", () => {
  it("starts empty, saves a recomputed score, and reloads it after a new store", async () => {
    const file = await tempFile();
    const store = createLeaderboardStore(file);
    expect(await store.list("player-test-01")).toEqual([]);
    const proof = submission(100, 2, 1);
    const saved = await store.submit(proof, "2026-10-26T12:00:00.000Z");
    expect(saved).toMatchObject({ stored: true, duplicate: false, score: 200 });
    const again = createLeaderboardStore(file);
    const rows = await again.list("player-test-01");
    expect(rows).toEqual([
      {
        id: proof.id,
        name: "رضا",
        score: 200,
        createdAt: "2026-10-26T12:00:00.000Z",
        seasonId: null,
        you: true,
        mode: "standard",
      },
    ]);
    const raw = JSON.parse(await readFile(file, "utf8")) as { records: StoredRecord[] };
    expect(raw.records[0]?.score).toBe(200);
    expect(raw.records[0]).not.toHaveProperty("events");
  });

  it("ignores a client-supplied score and rejects illegal events", async () => {
    const file = await tempFile();
    const store = createLeaderboardStore(file);
    const proof = submission(100, 1, 1);
    const parsed = parseSubmission({ ...proof, score: 999999 });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(submissionScore(parsed.value)).toBe(100);
    await store.submit(parsed.value, "2026-10-26T12:00:00.000Z");
    expect((await store.list())[0]?.score).toBe(100);
    expect(submissionScore(submission(17, 1, 1))).toBeNull();
    await expect(store.submit(submission(17, 1, 1))).rejects.toThrow("invalid-score");
    expect(await store.list()).toHaveLength(1);
  });

  it("sorts by score, keeps the top 20, and ignores duplicate ids", async () => {
    const file = await tempFile();
    const store = createLeaderboardStore(file);
    for (let removed = 1; removed <= 21; removed += 1) {
      const proof = submission(20 * removed, 1, 1, `run-board-${String(removed).padStart(2, "0")}`);
      await store.submit(proof, `2026-10-26T12:${String(removed).padStart(2, "0")}:00.000Z`);
    }
    const duplicate = await store.submit(submission(20 * 21, 1, 1, "run-board-21"), "2026-10-27T00:00:00.000Z");
    expect(duplicate.duplicate).toBe(true);
    const rows = await store.list();
    expect(rows).toHaveLength(20);
    expect(rows[0]?.score).toBe(420);
    expect(rows[19]?.score).toBe(40);
    expect(rows.some((row) => row.id === "run-board-01")).toBe(false);
  });

  it("serializes concurrent writes without dropping records", async () => {
    const file = await tempFile();
    const store = createLeaderboardStore(file);
    await Promise.all([1, 2, 3, 4].map((n) => store.submit(submission(20 * n, 1, 1, `run-race-${n}0`), `2026-10-26T12:0${n}:00.000Z`)));
    const rows = await store.list();
    expect(rows.map((row) => row.id).sort()).toEqual(["run-race-10", "run-race-20", "run-race-30", "run-race-40"]);
    const raw = await readFile(file, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("serves an empty board when the json file is missing or unreadable", async () => {
    const file = await tempFile();
    const missing = createLeaderboardStore(`${file}.missing`);
    expect(await missing.list()).toEqual([]);
    await writeFile(file, "{not json", "utf8");
    const store = createLeaderboardStore(file);
    expect(await store.list()).toEqual([]);
    const saved = await store.submit(submission(100, 1, 1), "2026-10-26T12:00:00.000Z");
    expect(saved.stored).toBe(true);
    expect(JSON.parse(await readFile(file, "utf8")).records).toHaveLength(1);
  });

  it("loads and rejects through the http handler", async () => {
    const file = await tempFile();
    const ok = await request(file, "POST", "/api/leaderboard", { ...submission(180, 1, 2), score: 5 });
    expect(ok.status).toBe(200);
    expect(JSON.parse(ok.body).score).toBe(360);
    const listed = await request(file, "GET", "/api/leaderboard?playerId=player-test-01");
    expect(JSON.parse(listed.body).records[0].you).toBe(true);
    const bad = await request(file, "POST", "/api/leaderboard", { ...submission(100, 1, 1, "run-bad-0001"), events: [{ type: "step", scoreBase: 7, combo: 1, boost: 1 }] });
    expect(bad.status).toBe(400);
    expect(normalizeLeaderboard(JSON.parse(listed.body))).toHaveLength(1);
    expect(normalizeLeaderboard("{")).toEqual([]);
  });
});

function submission(scoreBase: number, combo: number, boost: number, id = "run-test-0001"): ScoreSubmission {
  return {
    id,
    name: "رضا",
    playerId: "player-test-01",
    mode: "standard",
    events: [{ type: "step", scoreBase, combo, boost }],
  };
}

async function tempFile(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "chemball-board-"));
  dirs.push(dir);
  return join(dir, "leaderboard.json");
}

async function request(file: string, method: string, url: string, body?: unknown): Promise<{ status: number; body: string }> {
  const payload = body === undefined ? "" : JSON.stringify(body);
  const req = {
    method,
    url,
    destroy() {},
    on(event: string, listener: (chunk?: string) => void) {
      if (event === "data" && payload) listener(payload);
      if (event === "end") listener();
    },
  };
  let status = 0;
  let response = "";
  const res = {
    set statusCode(value: number) {
      status = value;
    },
    get statusCode() {
      return status;
    },
    setHeader() {},
    end(value?: string) {
      response = value ?? "";
    },
  };
  await handleLeaderboard(req as Parameters<typeof handleLeaderboard>[0], res as Parameters<typeof handleLeaderboard>[1], file);
  return { status, body: response };
}
