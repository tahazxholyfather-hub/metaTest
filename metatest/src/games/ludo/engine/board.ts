import { ARM_SPACING, LAST_MAIN_STEP, MAIN_PATH_LENGTH } from './config'
import type { Cell, PlayerColor, TokenLocation, TokenState } from './types'

export const PLAYER_COLORS: PlayerColor[] = ['blue', 'yellow', 'green', 'red']

export const PLAYER_ORDER_AROUND: PlayerColor[] = ['blue', 'yellow', 'green', 'red']

/** Clockwise main circuit. Index 0 is Blue's start square. */
export const MAIN_PATH: Cell[] = [
  { x: 8, y: 1 },
  { x: 8, y: 2 },
  { x: 8, y: 3 },
  { x: 8, y: 4 },
  { x: 8, y: 5 },
  { x: 9, y: 6 },
  { x: 10, y: 6 },
  { x: 11, y: 6 },
  { x: 12, y: 6 },
  { x: 13, y: 6 },
  { x: 14, y: 6 },
  { x: 14, y: 7 },
  { x: 14, y: 8 },
  { x: 13, y: 8 },
  { x: 12, y: 8 },
  { x: 11, y: 8 },
  { x: 10, y: 8 },
  { x: 9, y: 8 },
  { x: 8, y: 9 },
  { x: 8, y: 10 },
  { x: 8, y: 11 },
  { x: 8, y: 12 },
  { x: 8, y: 13 },
  { x: 8, y: 14 },
  { x: 7, y: 14 },
  { x: 6, y: 14 },
  { x: 6, y: 13 },
  { x: 6, y: 12 },
  { x: 6, y: 11 },
  { x: 6, y: 10 },
  { x: 6, y: 9 },
  { x: 5, y: 8 },
  { x: 4, y: 8 },
  { x: 3, y: 8 },
  { x: 2, y: 8 },
  { x: 1, y: 8 },
  { x: 0, y: 8 },
  { x: 0, y: 7 },
  { x: 0, y: 6 },
  { x: 1, y: 6 },
  { x: 2, y: 6 },
  { x: 3, y: 6 },
  { x: 4, y: 6 },
  { x: 5, y: 6 },
  { x: 6, y: 5 },
  { x: 6, y: 4 },
  { x: 6, y: 3 },
  { x: 6, y: 2 },
  { x: 6, y: 1 },
  { x: 6, y: 0 },
  { x: 7, y: 0 },
  { x: 8, y: 0 },
]

if (MAIN_PATH.length !== MAIN_PATH_LENGTH) {
  throw new Error(`MAIN_PATH must have ${MAIN_PATH_LENGTH} cells`)
}

export const START_INDEX: Record<PlayerColor, number> = {
  blue: 0,
  yellow: ARM_SPACING,
  green: ARM_SPACING * 2,
  red: ARM_SPACING * 3,
}

/** Home stretch walks inward toward the centre. */
export const HOME_STRETCH: Record<PlayerColor, Cell[]> = {
  blue: [
    { x: 7, y: 1 },
    { x: 7, y: 2 },
    { x: 7, y: 3 },
    { x: 7, y: 4 },
    { x: 7, y: 5 },
  ],
  yellow: [
    { x: 13, y: 7 },
    { x: 12, y: 7 },
    { x: 11, y: 7 },
    { x: 10, y: 7 },
    { x: 9, y: 7 },
  ],
  green: [
    { x: 7, y: 13 },
    { x: 7, y: 12 },
    { x: 7, y: 11 },
    { x: 7, y: 10 },
    { x: 7, y: 9 },
  ],
  red: [
    { x: 1, y: 7 },
    { x: 2, y: 7 },
    { x: 3, y: 7 },
    { x: 4, y: 7 },
    { x: 5, y: 7 },
  ],
}

export const FINISH_CELL: Record<PlayerColor, Cell> = {
  blue: { x: 7, y: 6.15 },
  yellow: { x: 8.15, y: 7 },
  green: { x: 7, y: 7.85 },
  red: { x: 5.85, y: 7 },
}

export const HOME_SLOTS: Record<PlayerColor, Cell[]> = {
  blue: [
    { x: 1.6, y: 1.6 },
    { x: 3.4, y: 1.6 },
    { x: 1.6, y: 3.4 },
    { x: 3.4, y: 3.4 },
  ],
  yellow: [
    { x: 10.6, y: 1.6 },
    { x: 12.4, y: 1.6 },
    { x: 10.6, y: 3.4 },
    { x: 12.4, y: 3.4 },
  ],
  green: [
    { x: 10.6, y: 10.6 },
    { x: 12.4, y: 10.6 },
    { x: 10.6, y: 12.4 },
    { x: 12.4, y: 12.4 },
  ],
  red: [
    { x: 1.6, y: 10.6 },
    { x: 3.4, y: 10.6 },
    { x: 1.6, y: 12.4 },
    { x: 3.4, y: 12.4 },
  ],
}

export const HOME_YARD: Record<PlayerColor, { x: number; y: number; size: number }> = {
  blue: { x: 0, y: 0, size: 6 },
  yellow: { x: 9, y: 0, size: 6 },
  red: { x: 0, y: 9, size: 6 },
  green: { x: 9, y: 9, size: 6 },
}

const SAFE_INDEXES = new Set<number>([
  START_INDEX.blue,
  START_INDEX.yellow,
  START_INDEX.green,
  START_INDEX.red,
  // Star squares, 8 steps after each start — the usual extra safes.
  (START_INDEX.blue + 8) % MAIN_PATH_LENGTH,
  (START_INDEX.yellow + 8) % MAIN_PATH_LENGTH,
  (START_INDEX.green + 8) % MAIN_PATH_LENGTH,
  (START_INDEX.red + 8) % MAIN_PATH_LENGTH,
])

export function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`
}

export function cellsEqual(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y
}

export function cellForSteps(color: PlayerColor, steps: number): Cell {
  if (steps <= LAST_MAIN_STEP) {
    const index = (START_INDEX[color] + steps) % MAIN_PATH_LENGTH
    return MAIN_PATH[index]!
  }
  if (steps <= LAST_MAIN_STEP + HOME_STRETCH.blue.length) {
    return HOME_STRETCH[color][steps - LAST_MAIN_STEP - 1]!
  }
  return FINISH_CELL[color]
}

export function tokenCell(token: TokenState): Cell {
  return locationCell(token.color, token.location, token.index)
}

export function locationCell(color: PlayerColor, location: TokenLocation, slot = 0): Cell {
  if (location.kind === 'home') return HOME_SLOTS[color][location.slot] ?? HOME_SLOTS[color][slot]!
  if (location.kind === 'finished') return FINISH_CELL[color]
  return cellForSteps(color, location.steps)
}

export function isSafeIndex(index: number): boolean {
  return SAFE_INDEXES.has(index)
}

export function isSafeCell(cell: Cell): boolean {
  return MAIN_PATH.some((c, i) => cellsEqual(c, cell) && SAFE_INDEXES.has(i))
}

export function isSafeLocation(color: PlayerColor, location: TokenLocation): boolean {
  if (location.kind !== 'track') return true
  if (location.steps > LAST_MAIN_STEP) return true
  const index = (START_INDEX[color] + location.steps) % MAIN_PATH_LENGTH
  return isSafeIndex(index)
}

export function isStarCell(cell: Cell): boolean {
  return MAIN_PATH.some((c, i) => cellsEqual(c, cell) && (i % ARM_SPACING === 8 || SAFE_INDEXES.has(i) && i % ARM_SPACING !== 0))
}

export function isStartCell(cell: Cell): boolean {
  return (Object.values(START_INDEX) as number[]).some((index) => cellsEqual(MAIN_PATH[index]!, cell))
}

export function startCell(color: PlayerColor): Cell {
  return MAIN_PATH[START_INDEX[color]]!
}

export function reachableDropCells(): Cell[] {
  return MAIN_PATH.filter((cell) => !isStartCell(cell))
}

export function pathBetween(color: PlayerColor, fromSteps: number, dice: number): Cell[] | null {
  const to = fromSteps + dice
  if (to > LAST_MAIN_STEP + HOME_STRETCH.blue.length + 1) return null
  const path: Cell[] = []
  for (let step = fromSteps + 1; step <= to; step++) {
    path.push(cellForSteps(color, step))
  }
  return path
}

export function colorsForPlayerCount(count: 2 | 3 | 4, humanColor: PlayerColor): PlayerColor[] {
  if (count === 4) {
    const start = PLAYER_ORDER_AROUND.indexOf(humanColor)
    return [0, 1, 2, 3].map((i) => PLAYER_ORDER_AROUND[(start + i) % 4]!)
  }
  if (count === 2) {
    const opposite: Record<PlayerColor, PlayerColor> = {
      blue: 'green',
      green: 'blue',
      yellow: 'red',
      red: 'yellow',
    }
    return [humanColor, opposite[humanColor]]
  }
  const trio: PlayerColor[] = ['blue', 'yellow', 'red']
  if (!trio.includes(humanColor)) {
    return [humanColor, 'blue', 'yellow']
  }
  const start = trio.indexOf(humanColor)
  return [0, 1, 2].map((i) => trio[(start + i) % 3]!)
}

export function gazeToward(from: Cell, to: Cell): { x: number; y: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const mag = Math.hypot(dx, dy)
  if (mag < 0.01) return { x: 0, y: 0 }
  return {
    x: Math.max(-1, Math.min(1, dx / mag)),
    y: Math.max(-1, Math.min(1, dy / mag)),
  }
}

export function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}
