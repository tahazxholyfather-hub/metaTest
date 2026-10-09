import { getElement } from "../data/elements";
import { Board, createBall } from "./board";
import { holeChance, materialChance } from "./difficulty";
import { COLS, cellKey, inBounds } from "./hex";
import { pick, weightedPick, type Rng } from "./rng";
import type { Ball } from "./types";

export type SpawnCell =
  | { kind: "empty" }
  | { kind: "element"; id: string }
  | { kind: "material"; id: string };

const BAND = ["H", "O", "C"] as const;

export function elementPool(factor: number): string[] {
  const pool = ["H", "O", "C"];
  if (factor >= 0.1) pool.push("Na", "Cl");
  if (factor >= 0.24) pool.push("S");
  if (factor >= 0.4) pool.push("Mg", "Fe");
  if (factor >= 0.62) pool.push("N", "Ca", "Al", "K");
  return pool;
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
  const source = present.length > 0 && rng() < 0.62 ? present : pool;
  return weightedPick(
    rng,
    source.map((id) => ({ id, weight: Math.max(1, 6 - getElement(id).rarity) })),
  );
}

export function createInitialBoard(rng: Rng, teach = true): Board {
  if (!teach) return createCalmBoard(rng);
  const board = new Board();
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const key = `${col},${row}`;
      if (key === "4,4") {
        board.add(createBall({ kind: "material", materialId: "water", col, row }));
        continue;
      }
      if (key === "3,4") {
        board.add(createBall({ kind: "element", elementId: "O", col, row }));
        continue;
      }
      if (key === "5,4") {
        board.add(createBall({ kind: "material", materialId: "fire", col, row }));
        continue;
      }
      board.add(createBall({ kind: "element", elementId: bandElement(col, row), col, row }));
    }
  }
  board.add(createBall({ kind: "material", materialId: "water", col: 4, row: 5 }));
  board.add(createBall({ kind: "material", materialId: "fire", col: 5, row: 6 }));
  for (const ball of board.all()) ball.born = 0;
  return board;
}

export function generateRow(rng: Rng, factor: number, touch: string[]): SpawnCell[] {
  const mask = formationMask(rng, factor);
  const pool = elementPool(factor);
  const cells: SpawnCell[] = mask.map((filled, col) => {
    if (!filled) return { kind: "empty" };
    return { kind: "element", id: pool[col % pool.length] ?? "H" };
  });
  const pair = pick(rng, pairsFor(pool));
  let pairCol = -1;
  for (let col = 2; col < COLS - 2; col += 1) {
    if (cells[col]?.kind === "element" && cells[col + 1]?.kind === "element") {
      cells[col] = { kind: "element", id: pair[0] };
      cells[col + 1] = { kind: "element", id: pair[1] };
      pairCol = col;
      break;
    }
  }
  if (factor >= 0.34 && rng() < Math.max(materialChance(factor), 0.01) * 3) {
    const slot = [4, 1, 5].find((index) => index !== pairCol && index !== pairCol + 1 && cells[index]?.kind === "element");
    if (slot !== undefined) cells[slot] = { kind: "material", id: spawnMaterial(rng, factor) };
  }
  const link = touch.find((id) => pool.includes(id));
  if (link && rng() < 0.4) {
    const edge = cells[0]?.kind === "element" ? 0 : cells[COLS - 1]?.kind === "element" ? COLS - 1 : -1;
    if (edge >= 0) cells[edge] = { kind: "element", id: link };
  }
  return cells;
}

export function shiftDown(board: Board, spawned: SpawnCell[]): void {
  const ordered = board.all().sort((a, b) => b.row - a.row || a.col - b.col);
  const occ = new Set<string>();
  const placed: Array<{ ball: Ball; col: number; row: number }> = [];
  for (const ball of ordered) {
    const frozen = ball.frozenShifts > 0;
    if (frozen) ball.frozenShifts -= 1;
    let destRow = frozen ? ball.row : ball.row + 1;
    if (!inBounds(ball.col, destRow) || occ.has(cellKey(ball.col, destRow))) {
      destRow = ball.row;
      if (occ.has(cellKey(ball.col, destRow))) {
        let drop = ball.row + 1;
        while (drop < 47 && occ.has(cellKey(ball.col, drop))) drop += 1;
        destRow = drop;
      }
    }
    occ.add(cellKey(ball.col, destRow));
    placed.push({ ball, col: ball.col, row: destRow });
  }
  board.balls.clear();
  board.cells.clear();
  for (const item of placed) {
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
  for (let row = 0; row < 4; row += 1) {
    const gap = rng() < 0.22 ? (rng() < 0.5 ? 0 : COLS - 1) : -1;
    for (let col = 0; col < COLS; col += 1) {
      if (col === gap) continue;
      board.add(createBall({ kind: "element", elementId: bandElement(col, row), col, row }));
    }
  }
  for (const ball of board.all()) ball.born = 0;
  return board;
}

function bandElement(col: number, row: number): string {
  return BAND[(col + row) % BAND.length] ?? "H";
}

function formationMask(rng: Rng, factor: number): boolean[] {
  const mask = Array.from({ length: COLS }, () => true);
  if (rng() < holeChance(factor)) mask[rng() < 0.5 ? 0 : COLS - 1] = false;
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

function spawnMaterial(rng: Rng, factor: number): string {
  const roll = rng();
  if (roll < 0.46) return "fire";
  if (roll < 0.72) return "ice";
  if (roll < 0.9) return "water";
  return factor > 0.7 ? "explosive" : "fire";
}
