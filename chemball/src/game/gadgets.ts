import { Board } from "./board";
import { hexDistance, inBounds, neighborCoords } from "./hex";
import type { Ball } from "./types";

export const GADGET_IDS = ["frost", "void", "magnet", "spark", "catalyst"] as const;
export type GadgetId = (typeof GADGET_IDS)[number];

export const GADGET_CHARGES: Record<GadgetId, number> = {
  frost: 2,
  void: 1,
  magnet: 2,
  spark: 2,
  catalyst: 2,
};

export function isGadget(id: string): id is GadgetId {
  return (GADGET_IDS as readonly string[]).includes(id);
}

export function emptyCharges(): Record<GadgetId, number> {
  return { ...GADGET_CHARGES };
}

export function encodeCharges(charges: Record<GadgetId, number>): string {
  return GADGET_IDS.map((id) => `${id}:${charges[id]}`).join(",");
}

export function applyFrost(board: Board, col: number, row: number): void {
  for (const [nextCol, nextRow] of neighborCoords(col, row)) {
    const ball = board.get(nextCol, nextRow);
    if (ball) ball.frozenShifts = Math.max(ball.frozenShifts, 3);
  }
}

export function applyVoid(board: Board, hit: Ball | undefined): boolean {
  if (!hit || hit.row <= 0) return false;
  board.remove(hit.id);
  return true;
}

export function applyMagnet(board: Board, col: number, row: number): number {
  const candidates = board
    .all()
    .filter((ball) => hexDistance(ball.col, ball.row, col, row) === 2)
    .sort((a, b) => a.row - b.row || a.col - b.col);
  let moved = 0;
  for (const ball of candidates) {
    if (moved >= 3) break;
    const step = neighborCoords(ball.col, ball.row).find(([nextCol, nextRow]) => {
      if (!inBounds(nextCol, nextRow) || board.occupied(nextCol, nextRow)) return false;
      return hexDistance(nextCol, nextRow, col, row) < hexDistance(ball.col, ball.row, col, row);
    });
    if (!step) continue;
    board.move(ball.id, step[0], step[1]);
    moved += 1;
  }
  return moved;
}
