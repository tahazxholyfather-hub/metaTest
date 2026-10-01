import { ionCharge } from "../data/elements";
import { sortedReactions } from "../data/reactions";
import { Board } from "./board";
import { hexDistance, inBounds, neighborCoords } from "./hex";
import type { Ball, PowerId, SoundId, VisualStyle } from "./types";

const PAPER: VisualStyle = { base: "#f7f4ee", glow: "#ffffff", rim: "#e4dfd6", ink: "#1a1c22", tint: "#e7eef6" };

export const POWER_LOOK: Record<PowerId, { glyph: string; formula: string; style: VisualStyle }> = {
  ion: { glyph: "Ion", formula: "Ion", style: { ...PAPER, tint: "#d9e7f6" } },
  catalyst: { glyph: "Cat", formula: "Catalyst", style: { ...PAPER, tint: "#e7f0dc" } },
  energy: { glyph: "En", formula: "Energy", style: { ...PAPER, tint: "#f6efd4" } },
  bond: { glyph: "Bond", formula: "Bond", style: { ...PAPER, tint: "#e8e4f4" } },
  unstable: { glyph: "Un", formula: "Unstable", style: { ...PAPER, tint: "#f6e4dc" } },
  magnet: { glyph: "Mag", formula: "Magnet", style: { ...PAPER, tint: "#e4eaf2" } },
  freeze: { glyph: "Frz", formula: "Freeze", style: { ...PAPER, tint: "#e4f2f4" } },
  void: { glyph: "Void", formula: "Void", style: { ...PAPER, tint: "#eceae6" } },
};

export interface PowerOutcome {
  log: string;
  focusIds: string[];
  extra: Array<{ type: "drift"; ballId: string; col: number; row: number }>;
  scoreBase: number;
  sound: SoundId;
}

const EMPTY: PowerOutcome = { log: "power:none", focusIds: [], extra: [], scoreBase: 0, sound: "powerActivate" };

export function applyPower(board: Board, power: PowerId, col: number, row: number, hitId?: string): PowerOutcome {
  if (power === "ion") return ionize(board, col, row, hitId);
  if (power === "catalyst") return catalyze(board, col, row, hitId);
  if (power === "energy") return energize(board, col, row, hitId);
  if (power === "bond") return bond(board, col, row);
  if (power === "unstable") return destabilize(board, hitId, col, row);
  if (power === "magnet") return magnet(board, col, row);
  if (power === "freeze") return freeze(board, col, row, hitId);
  return voidOut(board, hitId);
}

export function planDrift(board: Board): { ballId: string; col: number; row: number } | null {
  const charged = board.all().filter((ball) => ball.kind === "element" && ball.charge !== 0);
  let nearest: { a: Ball; b: Ball; dist: number } | null = null;
  for (let i = 0; i < charged.length; i += 1) {
    for (let j = i + 1; j < charged.length; j += 1) {
      const a = charged[i]!;
      const b = charged[j]!;
      if (a.charge === b.charge) continue;
      const dist = hexDistance(a.col, a.row, b.col, b.row);
      if (dist <= 1 || dist > 3) continue;
      if (!nearest || dist < nearest.dist) nearest = { a, b, dist };
    }
  }
  if (nearest) {
    const towardA = stepToward(board, nearest.a, nearest.b);
    if (towardA) return { ballId: nearest.a.id, ...towardA };
    const towardB = stepToward(board, nearest.b, nearest.a);
    if (towardB) return { ballId: nearest.b.id, ...towardB };
  }
  for (const ball of charged) {
    for (const [col, row] of neighborCoords(ball.col, ball.row)) {
      const other = board.get(col, row);
      if (!other || other.charge === 0 || other.charge !== ball.charge) continue;
      const away = stepAway(board, ball, other);
      if (away) return { ballId: ball.id, ...away };
    }
  }
  return null;
}

function ionize(board: Board, col: number, row: number, hitId?: string): PowerOutcome {
  const ordered = nearby(board, col, row, hitId).filter((ball) => ball.kind === "element" && ball.elementId && ball.charge === 0);
  const changed: string[] = [];
  for (const ball of ordered) {
    const charge = ball.elementId ? ionCharge(ball.elementId) : 0;
    if (!charge) continue;
    ball.charge = charge;
    ball.born = 0.65;
    changed.push(ball.id);
    if (changed.length >= 2) break;
  }
  if (!changed.length) return { ...EMPTY, log: "power:ion-empty" };
  return { log: "power:ion", focusIds: changed, extra: [], scoreBase: 20, sound: "ionize" };
}

function catalyze(board: Board, col: number, row: number, hitId?: string): PowerOutcome {
  const targets = nearby(board, col, row, hitId).slice(0, 4);
  for (const ball of targets) ball.catalyzed = true;
  return { log: "power:catalyst", focusIds: targets.map((ball) => ball.id), extra: [], scoreBase: 10, sound: "powerActivate" };
}

function energize(board: Board, col: number, row: number, hitId?: string): PowerOutcome {
  const targets = nearby(board, col, row, hitId).slice(0, 5);
  return { log: "power:energy", focusIds: targets.map((ball) => ball.id), extra: [], scoreBase: 15, sound: "energy" };
}

function bond(board: Board, col: number, row: number): PowerOutcome {
  const pair = bondPair(board, col, row);
  if (!pair) return { ...EMPTY, log: "power:bond-empty" };
  const [a, b] = pair;
  const dist = hexDistance(a.col, a.row, b.col, b.row);
  if (dist > 1) {
    const step = stepToward(board, a, b) ?? stepToward(board, b, a);
    const mover = step && stepToward(board, a, b) ? a : b;
    if (step) {
      return { log: "power:bond", focusIds: [mover.id], extra: [{ type: "drift", ballId: mover.id, ...step }], scoreBase: 10, sound: "bondForm" };
    }
  }
  a.bondedTo = b.id;
  b.bondedTo = a.id;
  a.born = 0.5;
  b.born = 0.5;
  return { log: "power:bond", focusIds: [a.id, b.id], extra: [], scoreBase: 15, sound: "bondForm" };
}

function destabilize(board: Board, hitId: string | undefined, col: number, row: number): PowerOutcome {
  const ball = (hitId && board.getId(hitId)) || nearby(board, col, row)[0];
  if (!ball) return { ...EMPTY, log: "power:unstable-empty" };
  ball.unstable = true;
  ball.born = 0.4;
  return { log: "power:unstable", focusIds: [ball.id], extra: [], scoreBase: 10, sound: "powerActivate" };
}

function magnet(board: Board, col: number, row: number): PowerOutcome {
  const candidates = board
    .all()
    .map((ball) => ({ ball, dist: hexDistance(col, row, ball.col, ball.row) }))
    .filter((item) => item.dist > 0 && item.dist <= 4)
    .sort((a, b) => a.dist - b.dist);
  for (const { ball } of candidates) {
    const step = stepToward(board, ball, { col, row });
    if (!step) continue;
    return { log: "power:magnet", focusIds: [ball.id], extra: [{ type: "drift", ballId: ball.id, ...step }], scoreBase: 10, sound: "powerActivate" };
  }
  return { ...EMPTY, log: "power:magnet-empty" };
}

function freeze(board: Board, col: number, row: number, hitId?: string): PowerOutcome {
  const targets = nearby(board, col, row, hitId);
  for (const ball of targets) ball.frozenShifts = Math.max(ball.frozenShifts, 4);
  return { log: "power:freeze", focusIds: [], extra: [], scoreBase: 10, sound: "freeze" };
}

function voidOut(board: Board, hitId?: string): PowerOutcome {
  const ball = hitId ? board.getId(hitId) : undefined;
  if (!ball || ball.row === 0) return { ...EMPTY, log: "power:void-empty" };
  board.remove(ball.id);
  return { log: "power:void", focusIds: [], extra: [], scoreBase: 30, sound: "orbDestroy" };
}

function nearby(board: Board, col: number, row: number, hitId?: string): Ball[] {
  const seen = new Set<string>();
  const out: Ball[] = [];
  const push = (ball: Ball | undefined) => {
    if (!ball || seen.has(ball.id)) return;
    seen.add(ball.id);
    out.push(ball);
  };
  if (hitId) push(board.getId(hitId));
  for (const ball of board.all()) {
    if (hexDistance(col, row, ball.col, ball.row) <= 1) push(ball);
  }
  return out;
}

function bondPair(board: Board, col: number, row: number): [Ball, Ball] | null {
  const recipes = new Set<string>();
  for (const reaction of sortedReactions()) {
    const elements = reaction.reactants.filter((need) => need.type === "element");
    if (elements.length < 2) continue;
    recipes.add([elements[0]!.id, elements[1]!.id].sort().join("+"));
  }
  const pool = board.all().filter((ball) => ball.kind === "element" && ball.elementId && hexDistance(col, row, ball.col, ball.row) <= 3);
  let best: { a: Ball; b: Ball; dist: number } | null = null;
  for (let i = 0; i < pool.length; i += 1) {
    for (let j = i + 1; j < pool.length; j += 1) {
      const a = pool[i]!;
      const b = pool[j]!;
      if (!a.elementId || !b.elementId || a.elementId === b.elementId) continue;
      const key = [a.elementId, b.elementId].sort().join("+");
      if (!recipes.has(key)) continue;
      const dist = hexDistance(a.col, a.row, b.col, b.row);
      if (!best || dist < best.dist) best = { a, b, dist };
    }
  }
  return best ? [best.a, best.b] : null;
}

function stepToward(board: Board, ball: Ball, target: { col: number; row: number }): { col: number; row: number } | null {
  const current = hexDistance(ball.col, ball.row, target.col, target.row);
  let best: { col: number; row: number; dist: number } | null = null;
  for (const [col, row] of neighborCoords(ball.col, ball.row)) {
    if (!inBounds(col, row) || board.occupied(col, row)) continue;
    const dist = hexDistance(col, row, target.col, target.row);
    if (dist >= current) continue;
    if (!best || dist < best.dist) best = { col, row, dist };
  }
  return best ? { col: best.col, row: best.row } : null;
}

function stepAway(board: Board, ball: Ball, other: Ball): { col: number; row: number } | null {
  const current = hexDistance(ball.col, ball.row, other.col, other.row);
  let best: { col: number; row: number; dist: number } | null = null;
  for (const [col, row] of neighborCoords(ball.col, ball.row)) {
    if (!inBounds(col, row) || board.occupied(col, row)) continue;
    const dist = hexDistance(col, row, other.col, other.row);
    if (dist <= current) continue;
    if (!best || dist > best.dist) best = { col, row, dist };
  }
  return best ? { col: best.col, row: best.row } : null;
}
