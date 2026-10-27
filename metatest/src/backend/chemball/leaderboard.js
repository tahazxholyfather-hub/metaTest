const fs = require("fs/promises");
const path = require("path");
const { LEADERBOARD_LIMIT, parseSubmission, submissionScore } = require("./scoreProof");

const MAX_BODY = 96_000;
const STORES = new Map();

function leaderboardPath() {
  return path.join(__dirname, "data", "chemball-leaderboard.json");
}

function leaderboardStore(filePath) {
  let store = STORES.get(filePath);
  if (!store) {
    store = createLeaderboardStore(filePath);
    STORES.set(filePath, store);
  }
  return store;
}

function createLeaderboardStore(filePath) {
  let tail = Promise.resolve();
  const exclusive = (task) => {
    const run = tail.then(task, task);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const empty = () => ({ records: [] });

  const load = async () => {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.records)) throw new Error("malformed");
      return { board: { records: parsed.records.filter(isStoredRecord) }, writable: true };
    } catch (error) {
      if (error && error.code === "ENOENT") return { board: empty(), writable: true };
      try {
        await fs.rename(filePath, `${filePath}.unreadable`);
        return { board: empty(), writable: true };
      } catch {
        return { board: empty(), writable: false };
      }
    }
  };

  const save = async (board) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temp = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify({ records: board.records }, null, 2));
    await fs.rename(temp, filePath);
  };

  return {
    filePath,
    async list(playerId = "") {
      const { board } = await exclusive(load);
      return toPublic([...board.records].sort(compareStored), playerId);
    },
    async submit(submission, achievedAt = new Date().toISOString()) {
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

async function handleLeaderboard(req, res, filePath = leaderboardPath()) {
  const store = leaderboardStore(filePath);
  try {
    if (req.method === "GET") {
      const playerId = typeof req.query?.playerId === "string" ? req.query.playerId : "";
      send(res, 200, { records: await store.list(safePlayerId(playerId)) });
      return;
    }
    if (req.method === "POST") {
      const raw = JSON.stringify(req.body ?? null);
      if (raw.length > MAX_BODY) {
        send(res, 413, { error: "too-large" });
        return;
      }
      const parsed = parseSubmission(req.body);
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

function handleChemballLeaderboard(req, res) {
  return handleLeaderboard(req, res, leaderboardPath());
}

function compareStored(a, b) {
  return b.score - a.score || a.achievedAt.localeCompare(b.achievedAt) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

function qualifies(records, score) {
  if (!Number.isSafeInteger(score) || score <= 0) return false;
  if (records.length < LEADERBOARD_LIMIT) return true;
  const lowest = records[records.length - 1];
  return Boolean(lowest) && score > lowest.score;
}

function toPublic(records, playerId) {
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

function isStoredRecord(value) {
  if (!value || typeof value !== "object") return false;
  return typeof value.id === "string"
    && typeof value.playerId === "string"
    && typeof value.name === "string"
    && typeof value.score === "number"
    && Number.isFinite(value.score)
    && typeof value.achievedAt === "string"
    && value.mode === "standard";
}

function safePlayerId(value) {
  return /^[A-Za-z0-9_-]{8,80}$/.test(value) ? value : "";
}

function send(res, status, body) {
  res.status(status).json(body);
}

module.exports = {
  createLeaderboardStore,
  handleChemballLeaderboard,
  handleLeaderboard,
  leaderboardPath,
  leaderboardStore,
};
