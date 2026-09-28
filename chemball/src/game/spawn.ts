import { getElement } from "../data/elements";
import { Board, createBall } from "./board";
import { holeChance, materialChance } from "./difficulty";
import { COLS, cellKey, inBounds, neighborCoords } from "./hex";
import { pick, weightedPick, type Rng } from "./rng";
import { findLoose } from "./sim";

export type SpawnCell =
  | { kind: "empty" }
  | { kind: "element"; id: string }
  | { kind: "material"; id: string };

const PROTECT = new Set(["3,4", "4,4", "4,5", "5,4", "5,6"]);
const CORRIDOR = new Set(["2,5", "2,6", "2,7", "3,5", "3,6", "3,7"]);

export function elementPool(factor: number): string[] {
  const pool = ["H", "O", "C", "Na", "Cl"];
  if (factor >= 0.18) pool.push("S", "Mg", "Fe");
  if (factor >= 0.42) pool.push("N", "Ca", "Al", "K");
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
  const source = present.length > 0 && rng() < 0.68 ? present : pool;
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
      if (CORRIDOR.has(key)) continue;
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
      board.add(createBall({ kind: "element", elementId: openingElement(rng), col, row }));
    }
  }
  board.add(createBall({ kind: "material", materialId: "water", col: 4, row: 5 }));
  board.add(createBall({ kind: "material", materialId: "fire", col: 5, row: 6 }));
  ensureIngredients(board);
  pokeHoles(board, rng);
  for (const ball of board.all()) ball.born = 0;
  return board;
}

export function generateRow(rng: Rng, factor: number, touch: string[]): SpawnCell[] {
  const mask = formationMask(rng, factor);
  const pool = elementPool(factor);
  const cells: SpawnCell[] = mask.map((filled) => {
    if (!filled) return { kind: "empty" };
    if (rng() < materialChance(factor)) {
      return { kind: "material", id: spawnMaterial(rng, factor) };
    }
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
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      board.add(createBall({ kind: "element", elementId: openingElement(rng), col, row }));
    }
  }
  ensureIngredients(board);
  pokeHoles(board, rng);
  for (const ball of board.all()) ball.born = 0;
  return board;
}

function openingElement(rng: Rng): string {
  return weightedPick(rng, [
    { id: "H", weight: 5 },
    { id: "O", weight: 5 },
    { id: "C", weight: 4 },
    { id: "Na", weight: 3 },
    { id: "Cl", weight: 3 },
    { id: "S", weight: 2 },
    { id: "Mg", weight: 2 },
    { id: "Fe", weight: 2 },
    { id: "N", weight: 1 },
  ]);
}

function ensureIngredients(board: Board): void {
  const need = ["H", "O", "Na", "Cl", "Mg", "Fe", "S"];
  const have = new Set(board.all().map((ball) => ball.elementId).filter((id): id is string => !!id));
  const flex = board.all().filter((ball) => ball.kind === "element" && !PROTECT.has(`${ball.col},${ball.row}`));
  let cursor = 0;
  for (const id of need) {
    if (have.has(id) || cursor >= flex.length) continue;
    const ball = flex[cursor];
    if (!ball) break;
    cursor += 1;
    ball.elementId = id;
    have.add(id);
  }
}

function pokeHoles(board: Board, rng: Rng): void {
  const candidates = board
    .all()
    .filter((ball) => ball.row > 0 && ball.row < 4 && !PROTECT.has(`${ball.col},${ball.row}`));
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = candidates[i]!;
    candidates[i] = candidates[j]!;
    candidates[j] = swap;
  }
  let holes = 0;
  for (const ball of candidates) {
    if (holes >= 5) break;
    const snapshot = { ...ball };
    board.remove(ball.id);
    const loose = findLoose(board);
    if (loose.fall.length || loose.rise.length) {
      board.add(createBall({ kind: snapshot.kind, elementId: snapshot.elementId, materialId: snapshot.materialId, col: snapshot.col, row: snapshot.row }));
      continue;
    }
    holes += 1;
  }
  bridgeLoose(board);
}

function bridgeLoose(board: Board): void {
  for (let pass = 0; pass < 6; pass += 1) {
    const loose = findLoose(board);
    const looseIds = new Set([...loose.fall, ...loose.rise]);
    const id = loose.fall[0] ?? loose.rise[0];
    if (!id) return;
    const ball = board.getId(id);
    if (!ball) return;
    let fixed = false;
    for (const [col, row] of neighborCoords(ball.col, ball.row)) {
      if (!inBounds(col, row) || board.occupied(col, row)) continue;
      if (CORRIDOR.has(`${col},${row}`)) continue;
      const touches = neighborCoords(col, row).some(([nc, nr]) => {
        const near = board.get(nc, nr);
        return !!near && !looseIds.has(near.id);
      });
      if (!touches) continue;
      board.add(createBall({ kind: "element", elementId: "C", col, row }));
      fixed = true;
      break;
    }
    if (!fixed) return;
  }
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
  if (mask.filter(Boolean).length < 4) {
    mask[2] = true;
    mask[3] = true;
    mask[4] = true;
  }
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
  if (roll < 0.42) return "fire";
  if (roll < 0.7) return "ice";
  if (roll < 0.88) return "water";
  return factor > 0.62 ? "explosive" : "fire";
}
