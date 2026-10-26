const assert = require("node:assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { createLeaderboardStore, handleLeaderboard } = require("./leaderboard");

const PLAYER = "player-chem-01";

function proof(id, base = 180, combo = 2, extra = {}) {
  return {
    id,
    name: "رضا",
    playerId: PLAYER,
    mode: "standard",
    events: [{ type: "step", scoreBase: base, combo, boost: 1 }],
    ...extra,
  };
}

async function tempFile() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "chemball-board-"));
  return path.join(dir, "leaderboard.json");
}

function response() {
  return {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
}

test("stores the recomputed score and ignores a client score field", async () => {
  const file = await tempFile();
  const store = createLeaderboardStore(file);
  const result = await store.submit(proof("run-score-01", 180, 2, { score: 999999 }));
  assert.equal(result.stored, true);
  assert.equal(result.score, 360);
  const again = createLeaderboardStore(`${file}.reload`);
  await fs.copyFile(file, again.filePath);
  const records = await again.list(PLAYER);
  assert.equal(records.length, 1);
  assert.equal(records[0].score, 360);
  assert.equal(records[0].you, true);
  assert.equal(records[0].playerId, undefined);
  const raw = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(raw.records[0].playerId, PLAYER);
});

test("rejects a step the chemistry tables do not allow", async () => {
  const store = createLeaderboardStore(await tempFile());
  await assert.rejects(() => store.submit(proof("run-bad-base", 17, 1)), /invalid-score/);
});

test("keeps the top 20 and treats a repeated id as a duplicate", async () => {
  const file = await tempFile();
  const store = createLeaderboardStore(file);
  for (let index = 1; index <= 21; index += 1) {
    const id = `run-board-${String(index).padStart(2, "0")}`;
    const saved = await store.submit(proof(id, 20, 1, { events: [{ type: "step", scoreBase: 20 * index, combo: 1, boost: 1 }] }));
    assert.equal(saved.stored, true);
  }
  const records = await store.list();
  assert.equal(records.length, 20);
  assert.equal(records[0].score, 420);
  assert.equal(records[19].score, 40);
  assert.equal(records.some((record) => record.id === "run-board-01"), false);
  const duplicate = await store.submit(proof("run-board-21", 20, 1, { events: [{ type: "step", scoreBase: 420, combo: 1, boost: 1 }] }));
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.stored, false);
});

test("serializes concurrent writes", async () => {
  const store = createLeaderboardStore(await tempFile());
  const results = await Promise.all([
    store.submit(proof("run-race-aaaa", 180, 1)),
    store.submit(proof("run-race-bbbb", 180, 2)),
    store.submit(proof("run-race-cccc", 90, 2)),
    store.submit(proof("run-race-dddd", 100, 1)),
  ]);
  assert.equal(results.filter((result) => result.stored).length, 4);
  const records = await store.list();
  assert.equal(records.length, 4);
  assert.deepEqual(records.map((record) => record.score), [360, 180, 180, 100]);
});

test("replaces unreadable JSON instead of crashing", async () => {
  const file = await tempFile();
  await fs.writeFile(file, "{not json", "utf8");
  const store = createLeaderboardStore(file);
  const records = await store.list();
  assert.deepEqual(records, []);
  const saved = await store.submit(proof("run-fresh-01"));
  assert.equal(saved.score, 360);
  const moved = await fs.readFile(`${file}.unreadable`, "utf8");
  assert.equal(moved, "{not json");
});

test("HTTP handler returns the saved row and hides the player id", async () => {
  const file = await tempFile();
  const res = response();
  await handleLeaderboard({ method: "POST", body: proof("run-http-001", 180, 2, { score: 999999 }), query: {} }, res, file);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.score, 360);
  assert.equal(res.body.records[0].you, true);
  assert.equal(res.body.records[0].playerId, undefined);
  const listed = response();
  await handleLeaderboard({ method: "GET", query: { playerId: PLAYER } }, listed, file);
  assert.equal(listed.body.records[0].score, 360);
});
