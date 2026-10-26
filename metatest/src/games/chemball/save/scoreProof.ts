import { MATERIALS } from "../data/materials";
import { REACTIONS } from "../data/reactions";
import { chainBonus } from "../game/score";

/** One scoring step the engine already applied. The server recomputes points from these inputs. */
export type ScoreEvent =
  | { type: "step"; scoreBase: number; combo: number; boost: number }
  | { type: "chain"; steps: number; combo: number };

export interface ScoreSubmission {
  id: string;
  name: string;
  playerId: string;
  mode: "standard";
  events: ScoreEvent[];
}

export const LEADERBOARD_LIMIT = 20;
export const MAX_SCORE_EVENTS = 800;

const ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const REACTION_BASES = new Set(REACTIONS.map((reaction) => reaction.scoreValue));
const REACTION_CHAIN_BASES = new Set(REACTIONS.map((reaction) => reaction.scoreValue + 100));
const MATERIAL_BASES = new Set(MATERIALS.map((material) => material.scoreValue));
const EXPLOSION_BASES = new Set([220, 500]);

export function scoreFromEvents(events: readonly ScoreEvent[]): number {
  let total = 0;
  for (const event of events) {
    if (event.type === "step") total += Math.round(event.scoreBase * event.combo * event.boost);
    else total += chainBonus(event.steps, event.combo);
  }
  return total;
}

export function cleanPlayerName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  let clean = "";
  for (const char of name) {
    if (char.charCodeAt(0) >= 32) clean += char;
  }
  clean = clean.trim();
  if (clean.length < 1 || clean.length > 16) return null;
  return clean;
}

export function parseSubmission(body: unknown): { ok: true; value: ScoreSubmission } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid" };
  const row = body as Record<string, unknown>;
  if (typeof row.id !== "string" || !ID_PATTERN.test(row.id)) return { ok: false, error: "invalid-id" };
  if (typeof row.playerId !== "string" || !ID_PATTERN.test(row.playerId)) return { ok: false, error: "invalid-player" };
  const name = cleanPlayerName(row.name);
  if (!name) return { ok: false, error: "invalid-name" };
  if (row.mode !== undefined && row.mode !== "standard") return { ok: false, error: "invalid-mode" };
  if (!Array.isArray(row.events) || row.events.length > MAX_SCORE_EVENTS) return { ok: false, error: "invalid-events" };
  const events: ScoreEvent[] = [];
  for (const item of row.events) {
    const event = parseEvent(item);
    if (!event) return { ok: false, error: "invalid-event" };
    events.push(event);
  }
  return { ok: true, value: { id: row.id, name, playerId: row.playerId, mode: "standard", events } };
}

export function submissionScore(submission: ScoreSubmission): number | null {
  if (submission.events.length > MAX_SCORE_EVENTS) return null;
  for (const event of submission.events) {
    if (!legalEvent(event)) return null;
  }
  const score = scoreFromEvents(submission.events);
  if (!Number.isSafeInteger(score) || score < 0) return null;
  return score;
}

function parseEvent(item: unknown): ScoreEvent | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  if (row.type === "step") {
    if (!isFiniteNumber(row.scoreBase) || !isFiniteNumber(row.combo) || !isFiniteNumber(row.boost)) return null;
    return { type: "step", scoreBase: row.scoreBase, combo: row.combo, boost: row.boost };
  }
  if (row.type === "chain") {
    if (!isFiniteNumber(row.steps) || !isFiniteNumber(row.combo)) return null;
    return { type: "chain", steps: row.steps, combo: row.combo };
  }
  return null;
}

function legalEvent(event: ScoreEvent): boolean {
  if (event.type === "chain") {
    return Number.isInteger(event.steps) && event.steps >= 3 && event.steps <= 36 && legalCombo(event.combo);
  }
  return legalStepBase(event.scoreBase) && legalCombo(event.combo) && (event.boost === 1 || event.boost === 2);
}

function legalCombo(combo: number): boolean {
  return Number.isInteger(combo) && combo >= 1 && combo <= 8;
}

function legalStepBase(base: number): boolean {
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
