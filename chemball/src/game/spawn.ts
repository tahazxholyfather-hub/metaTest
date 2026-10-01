import { getElement } from "../data/elements";
import { Board, createBall } from "./board";
import { holeChance } from "./difficulty";
import { COLS, cellKey, inBounds } from "./hex";
import { pick, weightedPick, type Rng } from "./rng";
import type { Ammo, PowerId } from "./types";

export type SpawnCell =
  | { kind: "empty" }
  | { kind: "element"; id: string }
  | { kind: "material"; id: string };

export function elementPool(factor: number): string[] {
  const pool = ["H", "O"];
  if (factor >= 0.16) pool.push("C");
  if (factor >= 0.32) pool.push("Na", "Cl");
  if (factor >= 0.48) pool.push("S", "N");
  if (factor >= 0.66) pool.push("Mg", "Fe", "Ca", "K", "Al", "P", "F");
  return pool;
}

export function nextAmmo(board: Board, rng: Rng, factor: number): Ammo {
  const powers = powersFor(board, factor);
  if (powers.length && rng() < Math.min(0.16, 0.04 + factor * 0.2)) {
    return { kind: "power", id: pick(rng, powers) };
  }
  return { kind: "element", id: nextShotElement(board, rng, factor) };
}

function powersFor(board: Board, factor: number): PowerId[] {
  const list: PowerId[] = [];
  const hasIonTarget = board.all().some((ball) => ball.elementId === "Na" || ball.elementId === "Cl" || ball.elementId === "K");
  if (factor >= 0.28 && hasIonTarget) list.push("ion");
  if (factor >= 0.4) list.push("catalyst", "bond");
  if (factor >= 0.52) list.push("energy", "magnet", "freeze");
  if (factor >= 0.7) list.push("unstable", "void");
  return list;
}

export function nextShotElement(board: Board, rng: Rng, factor: number): string {
  const pool = elementPool(factor);
  const present = [
    ...new Set(
      board
        .all()
        .filter((ball) => ball.kind === "element" && ball.elementId && pool.includes(ball.elementId))
        .map((ball) => ball.elementId!),
    ),
  ];
  if (factor < 0.16) {
    const hydrogen = board.all().filter((ball) => ball.elementId === "H").length;
    const oxygen = board.all().filter((ball) => ball.elementId === "O").length;
    if (hydrogen + 1 < oxygen * 2) return "H";
    if (oxygen < hydrogen / 2) return "O";
  }
  const source = present.length > 0 && rng() < 0.68 ? present : pool;
  return weightedPick(
    rng,
    source.map((id) => ({ id, weight: Math.max(1, 6 - getElement(id).rarity) })),
  );
}

export function createInitialBoard(rng: Rng, teach = true): Board {
  if (teach) return createLessonBoard();
  return createCalmBoard(rng);
}

/** Sparse lesson: one hydrogen beside one oxygen, with a clear shot into both. */
export function createLessonBoard(): Board {
  const board = new Board();
  const placed: Array<[number, number, string]> = [
    [3, 0, "H"],
    [3, 1, "O"],
    [3, 2, "H"],
    [3, 3, "O"],
    [3, 4, "O"],
    [4, 4, "H"],
  ];
  for (const [col, row, id] of placed) {
    const ball = createBall({ kind: "element", elementId: id, col, row });
    ball.born = 0;
    board.add(ball);
  }
  return board;
}

export function generateRow(rng: Rng, factor: number, touch: string[]): SpawnCell[] {
  const mask = formationMask(rng, factor);
  const pool = elementPool(factor);
  const cells: SpawnCell[] = mask.map((filled) => {
    if (!filled) return { kind: "empty" };
    return { kind: "element", id: weightedPick(rng, pool.map((id) => ({ id, weight: Math.max(1, 6 - getElement(id).rarity) }))) };
  });
  const pair = rng() < 0.55 ? pick(rng, pairsFor(pool)) : null;
  if (pair) {
    for (let col = 0; col < COLS - 1; col += 1) {
      if (cells[col]?.kind !== "empty" && cells[col + 1]?.kind !== "empty") {
        cells[col] = { kind: "element", id: pair[0] };
        cells[col + 1] = { kind: "element", id: pair[1] };
        break;
      }
    }
  }
  const link = touch.find((id) => pool.includes(id));
  if (link) {
    const slot = cells.findIndex((cell) => cell.kind === "element");
    if (slot >= 0) cells[slot] = { kind: "element", id: link };
  }
  if (!cells.slice(2, 5).some((cell) => cell.kind !== "empty")) {
    cells[3] = { kind: "element", id: pick(rng, pool) };
  }
  return cells;
}

export function shiftDown(board: Board, spawned: SpawnCell[]): void {
  const ordered = board.all().sort((a, b) => b.row - a.row || b.col - a.col);
  const placed: Array<{ ball: ReturnType<Board["getId"]>; col: number; row: number }> = [];
  const occ = new Set<string>();
  for (const ball of ordered) {
    if (!ball) continue;
    let targetRow = ball.row + 1;
    if (ball.frozenShifts > 0) {
      ball.frozenShifts -= 1;
      targetRow = ball.row;
    }
    const options: Array<[number, number]> = [
      [ball.col, targetRow],
      [ball.col - 1, targetRow],
      [ball.col + 1, targetRow],
      [ball.col, ball.row],
    ];
    let dest: [number, number] | null = null;
    for (const [col, row] of options) {
      if (!inBounds(col, row) || occ.has(cellKey(col, row))) continue;
      dest = [col, row];
      break;
    }
    if (!dest) {
      let row = ball.row + 2;
      while (occ.has(cellKey(ball.col, row))) row += 1;
      dest = [ball.col, row];
    }
    occ.add(cellKey(dest[0], dest[1]));
    placed.push({ ball, col: dest[0], row: dest[1] });
  }
  board.balls.clear();
  board.cells.clear();
  for (const item of placed) {
    if (!item.ball) continue;
    item.ball.col = item.col;
    item.ball.row = item.row;
    board.add(item.ball);
  }
  spawned.forEach((cell, col) => {
    if (cell.kind === "empty" || board.occupied(col, 0)) return;
    board.add(
      createBall({
        kind: cell.kind,
        elementId: cell.kind === "element" ? cell.id : undefined,
        materialId: cell.kind === "material" ? cell.id : undefined,
        col,
        row: 0,
      }),
    );
  });
}

function createCalmBoard(rng: Rng): Board {
  const board = new Board();
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (rng() < 0.48) continue;
      const ball = createBall({ kind: "element", elementId: rng() < 0.62 ? "H" : "O", col, row });
      ball.born = 0;
      board.add(ball);
    }
  }
  if (!board.all().some((ball) => ball.elementId === "H")) {
    board.add(createBall({ kind: "element", elementId: "H", col: 2, row: 0 }));
  }
  if (!board.all().some((ball) => ball.elementId === "O")) {
    board.add(createBall({ kind: "element", elementId: "O", col: 4, row: 0 }));
  }
  if (!board.get(3, 0)) board.add(createBall({ kind: "element", elementId: "H", col: 3, row: 0 }));
  for (const ball of board.all()) ball.born = 0;
  return board;
}

function formationMask(rng: Rng, factor: number): boolean[] {
  const pattern = pick(rng, ["row", "stagger", "cluster", "side", "windows"] as const);
  const holes = holeChance(factor);
  const mask = Array.from({ length: COLS }, (_, col) => {
    if (pattern === "stagger") return col % 2 === (rng() > 0.5 ? 0 : 1) ? rng() > holes * 0.4 : rng() > 0.72;
    if (pattern === "cluster") return col >= 1 && col <= 5 ? rng() > holes * 0.35 : rng() > 0.62;
    if (pattern === "side") return col <= 4 ? rng() > holes * 0.45 : rng() > 0.55;
    if (pattern === "windows") return col === 3 ? rng() > 0.75 : rng() > holes;
    return rng() > holes;
  });
  const cap = factor < 0.2 ? 3 : 5;
  let kept = 0;
  for (let col = 0; col < mask.length; col += 1) {
    if (!mask[col]) continue;
    kept += 1;
    if (kept > cap) mask[col] = false;
  }
  if (kept === 0) mask[3] = true;
  return mask;
}

function pairsFor(pool: string[]): Array<[string, string]> {
  const catalog: Array<[string, string]> = [
    ["H", "O"],
    ["Na", "Cl"],
    ["H", "Cl"],
    ["C", "O"],
    ["S", "O"],
    ["Mg", "O"],
    ["Fe", "C"],
  ];
  const allowed = catalog.filter((pair) => pool.includes(pair[0]) && pool.includes(pair[1]));
  return allowed.length ? allowed : [["H", "O"]];
}
