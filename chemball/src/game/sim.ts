import { hasTag } from "../data/elements";
import { getMaterial, isRisingMaterial } from "../data/materials";
import { getReaction, sortedReactions } from "../data/reactions";
import { Board } from "./board";
import { cellKey, hexDistance, inBounds, neighborCoords } from "./hex";
import { planDrift } from "./powers";
import type { Ball, BehaviorId, ReactionDef } from "./types";

export interface EffectPrediction {
  behavior: BehaviorId | "explode" | "none";
  removeIds: string[];
  transforms: Array<{ id: string; kind: "element" | "material"; elementId?: string; materialId?: string; impulse?: number }>;
  freezeIds: string[];
  pushes: Array<{ id: string; col: number; row: number }>;
  detonations: Detonation[];
  splash: Array<{ fromCol: number; fromRow: number; toCol: number; toRow: number }>;
  bolts: Array<{ fromId: string; toId: string }>;
}

export interface Detonation {
  col: number;
  row: number;
  radius: number;
  protectIds: string[];
  ignite: boolean;
  massive: boolean;
  scoreValue: number;
}

export type Command =
  | { type: "impact"; ballId: string }
  | { type: "reaction"; reactionId: string; ballIds: string[]; primaryId: string }
  | { type: "match"; materialId: string; ballIds: string[] }
  | { type: "effect"; behavior: BehaviorId; materialId: string; ballIds: string[] }
  | {
      type: "explode";
      col: number;
      row: number;
      radius: number;
      protectIds: string[];
      ignite: boolean;
      massive: boolean;
      scoreValue: number;
    }
  | { type: "rise"; ballId: string; row: number }
  | { type: "drift"; ballId: string; col: number; row: number }
  | { type: "clear"; mode: "fall" | "rise"; ballIds: string[] };

export interface ApplyResult {
  log: string;
  focusIds: string[];
  extra: Command[];
  countsAsStep: boolean;
  scoreBase: number;
  scoreKind: "reaction" | "match" | "explosion" | "clear" | "none";
  secondaryBonus: boolean;
  reactionId?: string;
  materialId?: string;
  removed: number;
  prediction?: EffectPrediction;
}

const EMPTY_RESULT: ApplyResult = {
  log: "none",
  focusIds: [],
  extra: [],
  countsAsStep: false,
  scoreBase: 0,
  scoreKind: "none",
  secondaryBonus: false,
  removed: 0,
};

export function selectReaction(
  board: Board,
  anchor: Ball,
): { reaction: ReactionDef; balls: Ball[]; primaryId: string } | null {
  for (const reaction of sortedReactions()) {
    const pool = ballsWithin(board, anchor, reaction.affectedRadius);
    const picked = allocate(reaction, pool, anchor);
    if (picked) return { reaction, balls: picked, primaryId: anchor.id };
  }
  return null;
}

export function connectedMaterial(board: Board, start: Ball): Ball[] {
  if (start.kind !== "material" || !start.materialId) return [];
  const want = start.materialId;
  const seen = new Set<string>();
  const stack = [start];
  const group: Ball[] = [];
  while (stack.length) {
    const ball = stack.pop()!;
    if (seen.has(ball.id)) continue;
    seen.add(ball.id);
    if (ball.kind !== "material" || ball.materialId !== want) continue;
    group.push(ball);
    for (const [col, row] of neighborCoords(ball.col, ball.row)) {
      const next = board.get(col, row);
      if (next && !seen.has(next.id)) stack.push(next);
    }
  }
  return group;
}

export function planCommand(board: Board, focus: string[]): Command | null {
  const impulseIds = board
    .all()
    .filter((ball) => ball.impulse > 0)
    .map((ball) => ball.id);
  const seeds = dedupe([...focus, ...impulseIds]);

  for (const id of seeds) {
    const ball = board.getId(id);
    if (!ball) continue;
    if (ball.unstable) {
      ball.unstable = false;
      return {
        type: "explode",
        col: ball.col,
        row: ball.row,
        radius: 1,
        protectIds: [],
        ignite: false,
        massive: false,
        scoreValue: 180,
      };
    }
    const reaction = selectReaction(board, ball);
    if (reaction && reaction.reaction.chainable !== false) {
      return {
        type: "reaction",
        reactionId: reaction.reaction.id,
        ballIds: reaction.balls.map((item) => item.id),
        primaryId: reaction.primaryId,
      };
    }
  }

  const drift = planDrift(board);
  if (drift) return { type: "drift", ballId: drift.ballId, col: drift.col, row: drift.row };

  for (const id of impulseIds) {
    const ball = board.getId(id);
    if (ball && ball.impulse > 0) return { type: "rise", ballId: id, row: ball.row };
  }

  const loose = findLoose(board);
  if (loose.fall.length) return { type: "clear", mode: "fall", ballIds: loose.fall };
  if (loose.rise.length) return { type: "clear", mode: "rise", ballIds: loose.rise };
  return null;
}

export function predictForCommand(board: Board, cmd: Command): EffectPrediction | undefined {
  if (cmd.type === "match") return predictEffect(board, getMaterial(cmd.materialId).behavior, cmd.ballIds);
  if (cmd.type === "effect") return predictEffect(board, cmd.behavior, cmd.ballIds);
  if (cmd.type === "explode") {
    return predictExplosion(board, cmd.col, cmd.row, cmd.radius, cmd.protectIds, cmd.ignite);
  }
  return undefined;
}

export function applyCommand(board: Board, cmd: Command, prediction?: EffectPrediction): ApplyResult {
  switch (cmd.type) {
    case "impact":
      return { ...EMPTY_RESULT, log: "impact", focusIds: [cmd.ballId] };
    case "reaction":
      return applyReaction(board, cmd);
    case "match": {
      const pred = prediction ?? predictEffect(board, getMaterial(cmd.materialId).behavior, cmd.ballIds);
      const applied = applyPrediction(board, pred);
      return {
        ...applied,
        log: `match:${cmd.materialId}`,
        countsAsStep: true,
        scoreBase: getMaterial(cmd.materialId).scoreValue,
        scoreKind: "match",
        materialId: cmd.materialId,
        prediction: pred,
      };
    }
    case "effect": {
      const pred = prediction ?? predictEffect(board, cmd.behavior, cmd.ballIds);
      const applied = applyPrediction(board, pred);
      return {
        ...applied,
        log: `effect:${cmd.behavior}`,
        countsAsStep: cmd.behavior === "corrode",
        scoreBase: cmd.behavior === "corrode" ? 40 : 0,
        scoreKind: cmd.behavior === "corrode" ? "reaction" : "none",
        prediction: pred,
      };
    }
    case "explode": {
      const pred = prediction ?? predictExplosion(board, cmd.col, cmd.row, cmd.radius, cmd.protectIds, cmd.ignite);
      const applied = applyPrediction(board, pred);
      return {
        ...applied,
        log: cmd.massive ? "explosion:massive" : "explosion",
        countsAsStep: true,
        scoreBase: cmd.scoreValue,
        scoreKind: "explosion",
        prediction: pred,
      };
    }
    case "rise":
      return applyRise(board, cmd.ballId);
    case "drift":
      return applyDrift(board, cmd.ballId, cmd.col, cmd.row);
    case "clear":
      return applyClear(board, cmd.ballIds, cmd.mode);
    default:
      return EMPTY_RESULT;
  }
}

export function resolveAll(board: Board, focus: string[], limit = 18): { log: string[]; steps: number } {
  const log: string[] = [];
  const queue: Command[] = [];
  let steps = 0;
  let guard = 0;
  let last = "";
  while (guard < limit) {
    guard += 1;
    const cmd = queue.shift() ?? planCommand(board, focus);
    if (!cmd) break;
    const sig = commandSig(cmd);
    if (sig === last) break;
    last = sig;
    const prediction = predictForCommand(board, cmd);
    const result = applyCommand(board, cmd, prediction);
    log.push(result.log);
    if (result.countsAsStep) steps += 1;
    queue.push(...result.extra);
    focus = result.focusIds;
    if (steps >= 12 && queue.length === 0) break;
  }
  return { log, steps };
}

export function findLoose(board: Board): { fall: string[]; rise: string[] } {
  const anchored = new Set<string>();
  const stack = board.all().filter((ball) => ball.row === 0);
  for (const ball of stack) anchored.add(ball.id);
  while (stack.length) {
    const ball = stack.pop()!;
    for (const [col, row] of neighborCoords(ball.col, ball.row)) {
      const next = board.get(col, row);
      if (!next || anchored.has(next.id)) continue;
      anchored.add(next.id);
      stack.push(next);
    }
  }
  const fall: string[] = [];
  const rise: string[] = [];
  for (const ball of board.all()) {
    if (anchored.has(ball.id)) continue;
    if (isRisingMaterial(ball.materialId)) rise.push(ball.id);
    else fall.push(ball.id);
  }
  return { fall, rise };
}

export function bestUpCell(board: Board, ball: Ball): { col: number; row: number } | null {
  const ups = neighborCoords(ball.col, ball.row)
    .filter(([col, row]) => row < ball.row && inBounds(col, row) && !board.occupied(col, row));
  if (!ups.length) return null;
  ups.sort((a, b) => Math.abs(a[0] - ball.col) - Math.abs(b[0] - ball.col) || a[0] - b[0]);
  return { col: ups[0]![0], row: ups[0]![1] };
}

export function commandSig(cmd: Command): string {
  switch (cmd.type) {
    case "impact":
      return `impact:${cmd.ballId}`;
    case "reaction":
      return `rx:${cmd.reactionId}:${[...cmd.ballIds].sort().join(",")}`;
    case "match":
      return `match:${cmd.materialId}:${[...cmd.ballIds].sort().join(",")}`;
    case "effect":
      return `effect:${cmd.behavior}:${cmd.ballIds.join(",")}`;
    case "explode":
      return `boom:${cmd.col},${cmd.row}:${cmd.radius}`;
    case "rise":
      return `rise:${cmd.ballId}@${cmd.row}`;
    case "drift":
      return `drift:${cmd.ballId}@${cmd.col},${cmd.row}`;
    case "clear":
      return `clear:${cmd.mode}:${[...cmd.ballIds].sort().join(",")}`;
  }
}

function applyReaction(board: Board, cmd: Extract<Command, { type: "reaction" }>): ApplyResult {
  const reaction = getReaction(cmd.reactionId);
  const primary = board.getId(cmd.primaryId);
  if (!primary) return EMPTY_RESULT;
  const product = reaction.products[0];
  if (!product) return EMPTY_RESULT;
  let removed = 0;
  for (const id of cmd.ballIds) {
    if (id === primary.id) continue;
    if (board.remove(id)) removed += 1;
  }
  const catalyzed = cmd.ballIds.some((id) => board.getId(id)?.catalyzed);
  primary.kind = "material";
  primary.elementId = undefined;
  primary.materialId = product.id;
  primary.charge = 0;
  primary.catalyzed = false;
  primary.unstable = false;
  primary.bondedTo = undefined;
  primary.frozenShifts = 0;
  primary.born = 1;
  const mat = getMaterial(product.id);
  primary.impulse = mat.movement === "rising" ? 4 : 0;
  const extra: Command[] = [];
  if (reaction.blastRadius && reaction.blastRadius > 0) {
    extra.push({
      type: "explode",
      col: primary.col,
      row: primary.row,
      radius: reaction.blastRadius,
      protectIds: reaction.consumeProduct ? [] : [primary.id],
      ignite: true,
      massive: reaction.blastRadius >= 2,
      scoreValue: reaction.blastRadius >= 2 ? 500 : 220,
    });
  }
  if (mat.onCreate) {
    extra.push({ type: "effect", behavior: mat.onCreate, materialId: mat.id, ballIds: [primary.id] });
  }
  return {
    log: `reaction:${reaction.id}`,
    focusIds: extra.length ? [] : [primary.id],
    extra,
    countsAsStep: true,
    scoreBase: catalyzed ? reaction.scoreValue * 2 : reaction.scoreValue,
    scoreKind: "reaction",
    secondaryBonus: true,
    reactionId: reaction.id,
    materialId: product.id,
    removed,
  };
}

function applyDrift(board: Board, id: string, col: number, row: number): ApplyResult {
  const ball = board.getId(id);
  if (!ball || board.occupied(col, row)) return EMPTY_RESULT;
  board.move(id, col, row);
  ball.born = 0.35;
  return { ...EMPTY_RESULT, log: "drift", focusIds: [ball.id] };
}

function applyRise(board: Board, id: string): ApplyResult {
  const ball = board.getId(id);
  if (!ball) return EMPTY_RESULT;
  const dest = bestUpCell(board, ball);
  if (!dest) {
    ball.impulse = 0;
    if (ball.row === 0 && ball.materialId === "smoke") {
      board.remove(ball.id);
      return { ...EMPTY_RESULT, log: "vent", removed: 1, scoreBase: 20, scoreKind: "clear" };
    }
    return { ...EMPTY_RESULT, log: "rise-blocked", focusIds: [id] };
  }
  board.move(id, dest.col, dest.row);
  ball.impulse = Math.max(0, ball.impulse - 1);
  ball.riseSteps += 1;
  if (ball.materialId === "steam" && ball.riseSteps >= 5) {
    ball.materialId = "water";
    ball.impulse = 0;
    ball.born = 0.7;
  }
  return { ...EMPTY_RESULT, log: "rise", focusIds: [ball.id] };
}

function applyClear(board: Board, ids: string[], mode: "fall" | "rise"): ApplyResult {
  let removed = 0;
  for (const id of ids) {
    if (board.remove(id)) removed += 1;
  }
  return {
    ...EMPTY_RESULT,
    log: mode === "fall" ? "fall" : "float",
    removed,
    scoreBase: mode === "fall" ? 20 * removed : 15 * removed,
    scoreKind: "clear",
  };
}

function applyPrediction(board: Board, pred: EffectPrediction): ApplyResult {
  const focus: string[] = [];
  for (const transform of pred.transforms) {
    const ball = board.getId(transform.id);
    if (!ball) continue;
    ball.kind = transform.kind;
    ball.elementId = transform.kind === "element" ? transform.elementId : undefined;
    ball.materialId = transform.kind === "material" ? transform.materialId : undefined;
    ball.impulse = transform.impulse ?? (isRisingMaterial(ball.materialId) ? 3 : 0);
    ball.frozenShifts = 0;
    ball.born = 1;
    focus.push(ball.id);
  }
  for (const id of pred.freezeIds) {
    const ball = board.getId(id);
    if (ball) ball.frozenShifts = Math.max(ball.frozenShifts, 2);
  }
  let removed = 0;
  const removedSet = new Set(pred.removeIds);
  for (const id of pred.removeIds) {
    if (board.remove(id)) removed += 1;
  }
  for (const push of pred.pushes) {
    const ball = board.getId(push.id);
    if (!ball || removedSet.has(push.id)) continue;
    if (board.occupied(push.col, push.row)) continue;
    board.move(push.id, push.col, push.row);
    focus.push(ball.id);
  }
  const extra: Command[] = pred.detonations.map((detonation) => ({
    type: "explode" as const,
    col: detonation.col,
    row: detonation.row,
    radius: detonation.radius,
    protectIds: detonation.protectIds,
    ignite: detonation.ignite,
    massive: detonation.massive,
    scoreValue: detonation.scoreValue,
  }));
  return {
    ...EMPTY_RESULT,
    focusIds: focus,
    extra,
    removed,
    prediction: pred,
  };
}

export function predictEffect(board: Board, behavior: BehaviorId, ids: string[]): EffectPrediction {
  switch (behavior) {
    case "splash-down":
      return predictSplash(board, ids);
    case "ignite":
      return predictIgnite(board, ids);
    case "rise-push":
      return predictPush(board, ids, "rise-push");
    case "vent":
      return predictPush(board, ids, "vent");
    case "dissolve":
      return predictDissolve(board, ids);
    case "explode":
      return predictMatchedExplosion(board, ids);
    case "freeze":
      return predictFreeze(board, ids);
    case "lightning":
      return predictLightning(board, ids);
    case "shatter":
      return predictShatter(board, ids);
    case "corrode":
      return predictCorrode(board, ids);
  }
}

function predictSplash(board: Board, ids: string[]): EffectPrediction {
  const matched = new Set(ids);
  const hit = new Set<string>();
  const pred = emptyPrediction("splash-down");
  pred.removeIds = [...ids];
  for (const id of ids) {
    const ball = board.getId(id);
    if (!ball) continue;
    const target = walkDown(board, ball.col, ball.row, matched);
    if (!target || hit.has(target.id)) continue;
    hit.add(target.id);
    pred.splash.push({ fromCol: ball.col, fromRow: ball.row, toCol: target.col, toRow: target.row });
    if (target.kind === "material" && target.materialId === "fire") {
      pred.transforms.push({ id: target.id, kind: "material", materialId: "steam", impulse: 4 });
    } else if (target.kind === "material" && target.materialId === "explosive") {
      pred.detonations.push(makeDetonation(target.col, target.row, 2, [], true));
    } else if (target.kind === "material" && target.materialId === "energy") {
      pred.transforms.push({ id: target.id, kind: "material", materialId: "charged", impulse: 0 });
    } else if (target.kind === "element" && (target.elementId === "Na" || target.elementId === "K")) {
      pred.detonations.push(makeDetonation(target.col, target.row, 1, [], true));
    }
  }
  return pred;
}

function predictIgnite(board: Board, ids: string[]): EffectPrediction {
  const matched = new Set(ids);
  const pred = emptyPrediction("ignite");
  pred.removeIds = [...ids];
  const neighbors = uniqueNeighbors(board, ids).filter((ball) => !matched.has(ball.id));
  for (const ball of neighbors.slice(0, 8)) {
    if (ball.kind === "material" && ball.materialId === "ice") {
      pred.transforms.push({ id: ball.id, kind: "material", materialId: "water", impulse: 0 });
    } else if (ball.kind === "material" && ball.materialId === "water") {
      pred.transforms.push({ id: ball.id, kind: "material", materialId: "steam", impulse: 3 });
    } else if (ball.kind === "material" && ball.materialId === "smoke") {
      pred.detonations.push(makeDetonation(ball.col, ball.row, 1, [], false));
    } else if (ball.kind === "material" && ball.materialId === "explosive") {
      pred.detonations.push(makeDetonation(ball.col, ball.row, 2, [], true));
    } else if (ball.kind === "element" && ball.elementId && hasTag(ball.elementId, "fuel")) {
      pred.transforms.push({ id: ball.id, kind: "material", materialId: "fire", impulse: 0 });
    }
  }
  return pred;
}

function predictPush(board: Board, ids: string[], behavior: "rise-push" | "vent"): EffectPrediction {
  const pred = emptyPrediction(behavior);
  pred.removeIds = [...ids];
  const removed = new Set(ids);
  const cols = new Set<number>();
  let minRow = Infinity;
  for (const id of ids) {
    const ball = board.getId(id);
    if (!ball) continue;
    cols.add(ball.col);
    minRow = Math.min(minRow, ball.row);
  }
  const occupancy = new Set<string>();
  for (const ball of board.all()) {
    if (removed.has(ball.id)) continue;
    occupancy.add(cellKey(ball.col, ball.row));
  }
  const movers = board
    .all()
    .filter((ball) => !removed.has(ball.id) && cols.has(ball.col) && ball.row < minRow)
    .sort((a, b) => a.row - b.row);
  for (const ball of movers) {
    const nextRow = ball.row - 1;
    if (nextRow < 0) continue;
    const key = cellKey(ball.col, nextRow);
    if (occupancy.has(key)) continue;
    occupancy.delete(cellKey(ball.col, ball.row));
    occupancy.add(key);
    pred.pushes.push({ id: ball.id, col: ball.col, row: nextRow });
  }
  return pred;
}

function predictDissolve(board: Board, ids: string[]): EffectPrediction {
  const pred = emptyPrediction("dissolve");
  pred.removeIds = [...ids];
  const matched = new Set(ids);
  for (const ball of uniqueNeighbors(board, ids)) {
    if (matched.has(ball.id)) continue;
    if (ball.kind === "element" && ball.elementId && hasTag(ball.elementId, "metal")) {
      pred.removeIds.push(ball.id);
    } else if (ball.kind === "material" && (ball.materialId === "crystal" || ball.materialId === "corrosion")) {
      pred.removeIds.push(ball.id);
    } else if (ball.kind === "material" && ball.materialId === "water") {
      pred.transforms.push({ id: ball.id, kind: "material", materialId: "acid", impulse: 0 });
    }
  }
  return pred;
}

function predictMatchedExplosion(board: Board, ids: string[]): EffectPrediction {
  const centers = ids
    .map((id) => board.getId(id))
    .filter((ball): ball is Ball => !!ball);
  const origin = centers[Math.floor(centers.length / 2)] ?? centers[0];
  if (!origin) return emptyPrediction("explode");
  const pred = predictExplosion(board, origin.col, origin.row, 2, [], true);
  for (const id of ids) {
    if (!pred.removeIds.includes(id)) pred.removeIds.push(id);
  }
  pred.behavior = "explode";
  return pred;
}

function predictFreeze(board: Board, ids: string[]): EffectPrediction {
  const pred = emptyPrediction("freeze");
  pred.removeIds = [...ids];
  const matched = new Set(ids);
  for (const ball of uniqueNeighbors(board, ids).slice(0, 8)) {
    if (matched.has(ball.id)) continue;
    if (ball.kind === "material" && ball.materialId === "water") {
      pred.transforms.push({ id: ball.id, kind: "material", materialId: "ice", impulse: 0 });
    } else {
      pred.freezeIds.push(ball.id);
    }
  }
  return pred;
}

function predictLightning(board: Board, ids: string[]): EffectPrediction {
  const pred = emptyPrediction("lightning");
  pred.removeIds = [...ids];
  const origins = ids.map((id) => board.getId(id)).filter((ball): ball is Ball => !!ball);
  const origin = origins[0];
  if (!origin) return pred;
  const candidates = board
    .all()
    .filter((ball) => !ids.includes(ball.id))
    .map((ball) => ({ ball, dist: hexDistance(origin.col, origin.row, ball.col, ball.row) }))
    .filter((item) => item.dist > 0 && item.dist <= 3)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5);
  for (const { ball } of candidates) {
    pred.bolts.push({ fromId: origin.id, toId: ball.id });
    if (ball.kind === "material" && ball.materialId === "explosive") {
      pred.detonations.push(makeDetonation(ball.col, ball.row, 2, [], true));
    } else if (ball.kind === "material" && ball.materialId === "water") {
      pred.transforms.push({ id: ball.id, kind: "material", materialId: "charged", impulse: 0 });
    } else if (ball.kind === "material" && ball.materialId === "ice") {
      pred.transforms.push({ id: ball.id, kind: "material", materialId: "water", impulse: 0 });
    } else if (ball.kind === "element" && ball.elementId && hasTag(ball.elementId, "fuel")) {
      pred.transforms.push({ id: ball.id, kind: "material", materialId: "fire", impulse: 0 });
    }
  }
  return pred;
}

function predictShatter(board: Board, ids: string[]): EffectPrediction {
  const pred = emptyPrediction("shatter");
  const remove = new Set(ids);
  for (const ball of uniqueNeighbors(board, ids)) remove.add(ball.id);
  pred.removeIds = [...remove];
  const origin = board.getId(ids[0] ?? "");
  if (!origin) return pred;
  for (const ball of board.all()) {
    if (remove.has(ball.id)) continue;
    if (ball.kind === "material" && ball.materialId === "water" && hexDistance(origin.col, origin.row, ball.col, ball.row) <= 2) {
      pred.transforms.push({ id: ball.id, kind: "material", materialId: "ice", impulse: 0 });
    }
  }
  return pred;
}

function predictCorrode(board: Board, ids: string[]): EffectPrediction {
  const pred = emptyPrediction("corrode");
  const remove = new Set(ids);
  for (const ball of uniqueNeighbors(board, ids)) {
    if (ball.kind === "element" && ball.elementId && hasTag(ball.elementId, "metal")) remove.add(ball.id);
    else if (ball.kind === "material" && ball.materialId === "crystal") remove.add(ball.id);
  }
  pred.removeIds = [...remove];
  return pred;
}

export function predictExplosion(
  board: Board,
  col: number,
  row: number,
  radius: number,
  protectIds: string[],
  ignite: boolean,
): EffectPrediction {
  const pred = emptyPrediction("explode");
  const protect = new Set(protectIds);
  for (const ball of board.all()) {
    const dist = hexDistance(col, row, ball.col, ball.row);
    if (dist <= radius && !protect.has(ball.id)) pred.removeIds.push(ball.id);
    else if (ignite && dist === radius + 1 && ball.kind === "element" && ball.elementId && hasTag(ball.elementId, "fuel")) {
      pred.transforms.push({ id: ball.id, kind: "material", materialId: "fire", impulse: 0 });
    }
  }
  return pred;
}

function walkDown(board: Board, startCol: number, startRow: number, passThrough: Set<string>): Ball | null {
  let frontier: Array<[number, number]> = [[startCol, startRow]];
  const seen = new Set<string>([cellKey(startCol, startRow)]);
  for (let depth = 0; depth < 7 && frontier.length; depth += 1) {
    const next: Array<[number, number]> = [];
    frontier.sort((a, b) => Math.abs(a[0] - startCol) - Math.abs(b[0] - startCol));
    for (const [col, row] of frontier) {
      const downs = neighborCoords(col, row)
        .filter(([nc, nr]) => nr > row && inBounds(nc, nr))
        .sort((a, b) => Math.abs(a[0] - startCol) - Math.abs(b[0] - startCol));
      for (const [nc, nr] of downs) {
        const key = cellKey(nc, nr);
        if (seen.has(key)) continue;
        seen.add(key);
        const ball = board.get(nc, nr);
        if (!ball || passThrough.has(ball.id)) {
          next.push([nc, nr]);
          continue;
        }
        return ball;
      }
    }
    frontier = next;
  }
  return null;
}

function uniqueNeighbors(board: Board, ids: string[]): Ball[] {
  const seen = new Set<string>();
  const out: Ball[] = [];
  for (const id of ids) {
    const ball = board.getId(id);
    if (!ball) continue;
    for (const [col, row] of neighborCoords(ball.col, ball.row)) {
      const next = board.get(col, row);
      if (!next || seen.has(next.id) || ids.includes(next.id)) continue;
      seen.add(next.id);
      out.push(next);
    }
  }
  return out;
}

function ballsWithin(board: Board, origin: Ball, radius: number): Ball[] {
  return board.all().filter((ball) => hexDistance(origin.col, origin.row, ball.col, ball.row) <= radius);
}

function allocate(reaction: ReactionDef, pool: Ball[], anchor: Ball): Ball[] | null {
  const needs = reaction.reactants.map((reactant) => ({ ...reactant }));
  const role = needs.find((need) => need.count > 0 && fits(anchor, need));
  if (!role) return null;
  role.count -= 1;
  const used = [anchor];
  const rest = pool
    .filter((ball) => ball.id !== anchor.id)
    .sort((a, b) => hexDistance(anchor.col, anchor.row, a.col, a.row) - hexDistance(anchor.col, anchor.row, b.col, b.row));
  for (const need of needs) {
    while (need.count > 0) {
      const index = rest.findIndex((ball) => fits(ball, need));
      if (index < 0) return null;
      const [ball] = rest.splice(index, 1);
      if (!ball) return null;
      used.push(ball);
      need.count -= 1;
    }
  }
  return used;
}

function fits(ball: Ball, need: { type: "element" | "material"; id: string; charge?: -1 | 0 | 1 }): boolean {
  if (need.charge !== undefined && ball.charge !== need.charge) return false;
  if (need.type === "element") return ball.kind === "element" && ball.elementId === need.id;
  return ball.kind === "material" && ball.materialId === need.id;
}

function makeDetonation(col: number, row: number, radius: number, protectIds: string[], massive: boolean): Detonation {
  return {
    col,
    row,
    radius,
    protectIds,
    ignite: true,
    massive,
    scoreValue: massive ? 500 : 220,
  };
}

function emptyPrediction(behavior: EffectPrediction["behavior"]): EffectPrediction {
  return {
    behavior,
    removeIds: [],
    transforms: [],
    freezeIds: [],
    pushes: [],
    detonations: [],
    splash: [],
    bolts: [],
  };
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}
