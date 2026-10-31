import { cellKey, inBounds } from "./hex";
import type { Ball, BallKind } from "./types";

let nextId = 1;

export function resetIds(): void {
  nextId = 1;
}

export function uid(prefix = "b"): string {
  nextId += 1;
  return `${prefix}${nextId}`;
}

export function createBall(input: {
  kind: BallKind;
  elementId?: string;
  materialId?: string;
  col: number;
  row: number;
  impulse?: number;
}): Ball {
  return {
    id: uid(),
    kind: input.kind,
    elementId: input.elementId,
    materialId: input.materialId,
    col: input.col,
    row: input.row,
    frozenShifts: 0,
    impulse: input.impulse ?? 0,
    riseSteps: 0,
    born: 1,
  };
}

export class Board {
  readonly balls = new Map<string, Ball>();
  readonly cells = new Map<string, string>();

  get(col: number, row: number): Ball | undefined {
    const id = this.cells.get(cellKey(col, row));
    return id ? this.balls.get(id) : undefined;
  }

  getId(id: string): Ball | undefined {
    return this.balls.get(id);
  }

  all(): Ball[] {
    return [...this.balls.values()];
  }

  add(ball: Ball): void {
    if (!inBounds(ball.col, ball.row)) return;
    const key = cellKey(ball.col, ball.row);
    const existing = this.cells.get(key);
    if (existing && existing !== ball.id) this.balls.delete(existing);
    this.balls.set(ball.id, ball);
    this.cells.set(key, ball.id);
  }

  remove(id: string): Ball | undefined {
    const ball = this.balls.get(id);
    if (!ball) return undefined;
    this.balls.delete(id);
    const key = cellKey(ball.col, ball.row);
    if (this.cells.get(key) === id) this.cells.delete(key);
    return ball;
  }

  move(id: string, col: number, row: number): void {
    const ball = this.balls.get(id);
    if (!ball || !inBounds(col, row)) return;
    const prev = cellKey(ball.col, ball.row);
    if (this.cells.get(prev) === id) this.cells.delete(prev);
    ball.col = col;
    ball.row = row;
    this.cells.set(cellKey(col, row), id);
  }

  occupied(col: number, row: number): boolean {
    return this.cells.has(cellKey(col, row));
  }
}

export function isStable(ball: Ball | undefined): ball is Ball {
  return !!ball;
}
