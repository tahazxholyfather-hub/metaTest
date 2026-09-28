import type { Layout } from "./types";

export const COLS = 7;

const EVEN_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [0, 1],
  [-1, 1],
];

const ODD_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [1, 1],
  [0, 1],
];

export function neighborCoords(col: number, row: number): Array<[number, number]> {
  const dirs = (row & 1) === 0 ? EVEN_DIRS : ODD_DIRS;
  return dirs.map(([dc, dr]) => [col + dc, row + dr]);
}

export function inBounds(col: number, row: number, cols = COLS): boolean {
  return col >= 0 && col < cols && row >= 0 && row < 48;
}

export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function offsetToCube(col: number, row: number): { x: number; y: number; z: number } {
  const x = col - Math.floor((row - (row & 1)) / 2);
  const z = row;
  const y = -x - z;
  return { x, y, z };
}

export function hexDistance(c1: number, r1: number, c2: number, r2: number): number {
  const a = offsetToCube(c1, r1);
  const b = offsetToCube(c2, r2);
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
}

export function makeLayout(width: number, height: number): Layout {
  const cols = COLS;
  const margin = 10;
  const xSpacing = (width - margin * 2) / (cols + 0.5);
  const radius = xSpacing / Math.sqrt(3);
  const ySpacing = radius * 1.5;
  const drawRadius = xSpacing * 0.5 * 0.92;
  const launcherY = height - Math.max(78, height * 0.1);
  const dangerY = launcherY - Math.max(58, drawRadius * 2.4);
  const originY = Math.max(78, height * 0.09) + drawRadius;
  return {
    width,
    height,
    cols,
    xSpacing,
    ySpacing,
    radius,
    drawRadius,
    originX: margin,
    originY,
    launcherX: width / 2,
    launcherY,
    dangerY,
    topLimit: originY - drawRadius * 0.35,
  };
}

export function cellCenter(
  col: number,
  row: number,
  layout: Layout,
  descent = 0,
): { x: number; y: number } {
  const x = layout.originX + layout.xSpacing * (col + 0.5 + (row % 2) * 0.5);
  const y = layout.originY + layout.ySpacing * row + descent;
  return { x, y };
}

export function cellInside(col: number, row: number, layout: Layout): boolean {
  if (!inBounds(col, row, layout.cols)) return false;
  const { x } = cellCenter(col, row, layout, 0);
  return x > layout.drawRadius * 0.7 && x < layout.width - layout.drawRadius * 0.7;
}
