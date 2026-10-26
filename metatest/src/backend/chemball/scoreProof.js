const fs = require("fs");
const path = require("path");

/**
 * Server-side score check for Chemball.
 * Step bases come from the game's reaction and material tables.
 * Chain points match `chainBonus` in `src/games/chemball/game/score.ts` (`200 * combo` once steps >= 3).
 */

const DATA_DIR = path.join(__dirname, "../../games/chemball/data");
const LEADERBOARD_LIMIT = 20;
const MAX_SCORE_EVENTS = 800;
const ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;

function scoreValues(fileName) {
  const text = fs.readFileSync(path.join(DATA_DIR, fileName), "utf8");
  return new Set([...text.matchAll(/scoreValue:\s*(\d+)/g)].map((match) => Number(match[1])));
}

const REACTION_BASES = scoreValues("reactions.ts");
const MATERIAL_BASES = scoreValues("materials.ts");
const REACTION_CHAIN_BASES = new Set([...REACTION_BASES].map((value) => value + 100));
const EXPLOSION_BASES = new Set([220, 500]);

function chainBonus(steps, combo) {
  if (steps < 3) return 0;
  return 200 * combo;
}

function scoreFromEvents(events) {
  let total = 0;
  for (const event of events) {
    if (event.type === "step") total += Math.round(event.scoreBase * event.combo * event.boost);
    else total += chainBonus(event.steps, event.combo);
  }
  return total;
}

function cleanPlayerName(name) {
  if (typeof name !== "string") return null;
  let clean = "";
  for (const char of name) {
    if (char.charCodeAt(0) >= 32) clean += char;
  }
  clean = clean.trim();
  if (clean.length < 1 || clean.length > 16) return null;
  return clean;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function parseEvent(item) {
  if (!item || typeof item !== "object") return null;
  if (item.type === "step") {
    if (!isFiniteNumber(item.scoreBase) || !isFiniteNumber(item.combo) || !isFiniteNumber(item.boost)) return null;
    return { type: "step", scoreBase: item.scoreBase, combo: item.combo, boost: item.boost };
  }
  if (item.type === "chain") {
    if (!isFiniteNumber(item.steps) || !isFiniteNumber(item.combo)) return null;
    return { type: "chain", steps: item.steps, combo: item.combo };
  }
  return null;
}

function legalCombo(combo) {
  return Number.isInteger(combo) && combo >= 1 && combo <= 8;
}

function legalStepBase(base) {
  if (!Number.isInteger(base) || base <= 0 || base > 20 * 48) return false;
  if (REACTION_BASES.has(base) || REACTION_CHAIN_BASES.has(base) || MATERIAL_BASES.has(base)) return true;
  if (EXPLOSION_BASES.has(base) || base === 40 || base === 20) return true;
  if (base % 20 === 0) {
    const removed = base / 20;
    return removed >= 1 && removed <= 48;
  }
  if (base % 15 === 0) {
    const removed = base / 15;
    return removed >= 1 && removed <= 48;
  }
  return false;
}

function legalEvent(event) {
  if (event.type === "chain") {
    return Number.isInteger(event.steps) && event.steps >= 3 && event.steps <= 36 && legalCombo(event.combo);
  }
  return legalStepBase(event.scoreBase) && legalCombo(event.combo) && (event.boost === 1 || event.boost === 2);
}

function parseSubmission(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid" };
  if (typeof body.id !== "string" || !ID_PATTERN.test(body.id)) return { ok: false, error: "invalid-id" };
  if (typeof body.playerId !== "string" || !ID_PATTERN.test(body.playerId)) return { ok: false, error: "invalid-player" };
  const name = cleanPlayerName(body.name);
  if (!name) return { ok: false, error: "invalid-name" };
  if (body.mode !== undefined && body.mode !== "standard") return { ok: false, error: "invalid-mode" };
  if (!Array.isArray(body.events) || body.events.length > MAX_SCORE_EVENTS) return { ok: false, error: "invalid-events" };
  const events = [];
  for (const item of body.events) {
    const event = parseEvent(item);
    if (!event) return { ok: false, error: "invalid-event" };
    events.push(event);
  }
  return { ok: true, value: { id: body.id, name, playerId: body.playerId, mode: "standard", events } };
}

function submissionScore(submission) {
  if (submission.events.length > MAX_SCORE_EVENTS) return null;
  for (const event of submission.events) {
    if (!legalEvent(event)) return null;
  }
  const score = scoreFromEvents(submission.events);
  if (!Number.isSafeInteger(score) || score < 0) return null;
  return score;
}

module.exports = {
  LEADERBOARD_LIMIT,
  MAX_SCORE_EVENTS,
  parseSubmission,
  submissionScore,
  scoreFromEvents,
};
