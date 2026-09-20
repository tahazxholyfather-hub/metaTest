import { SeededRng } from './rng'
import { cellKey, reachableDropCells } from './board'
import type { Cell, DropSchedulerState, DropState, GameConfig, GameState } from './types'
import { DROP_ITEM_TYPES, ITEM_CATALOG, weightedPick } from './catalog'

export function scheduleFirstDrop(rng: SeededRng, now: number, config: GameConfig): DropSchedulerState {
  const wait = rng.int(config.drops.dropIntervalMin, config.drops.dropIntervalMax)
  const nextAt = now + wait
  return {
    phase: wait <= config.drops.announceLead ? 'countdown' : 'idle',
    nextAt,
    announceAt: nextAt - config.drops.announceLead,
    active: [],
    recentCells: [],
  }
}

export function tickDrops(state: GameState, rng: SeededRng): { state: GameState; spawned: DropState[]; expired: DropState[]; announced: boolean } {
  const config = state.config.drops
  const now = state.now
  let drops = { ...state.drops, active: state.drops.active.slice(), recentCells: state.drops.recentCells.slice() }
  const spawned: DropState[] = []
  const expired: DropState[] = []
  let announced = false

  drops.active = drops.active.filter((drop) => {
    if (drop.expiresAt <= now) {
      expired.push(drop)
      return false
    }
    return true
  })

  if (drops.phase === 'idle' && now >= drops.announceAt && now < drops.nextAt) {
    drops = { ...drops, phase: 'countdown' }
    announced = true
  }

  if (now >= drops.nextAt && drops.active.length < config.maxActiveDrops) {
    const drop = spawnDrop(state, drops, rng)
    if (drop) {
      spawned.push(drop)
      drops.active.push(drop)
      drops.recentCells = [...drops.recentCells, cellKey(drop.cell)].slice(-12)
    }
    const wait = rng.int(config.dropIntervalMin, config.dropIntervalMax)
    drops.nextAt = now + wait
    drops.announceAt = drops.nextAt - config.announceLead
    drops.phase = 'idle'
  } else if (drops.active.length > 0) {
    drops.phase = 'active'
  } else if (now >= drops.announceAt && now < drops.nextAt) {
    drops.phase = 'countdown'
  }

  return { state: { ...state, drops }, spawned, expired, announced }
}

export function spawnDrop(state: GameState, drops: DropSchedulerState, rng: SeededRng): DropState | null {
  const occupied = new Set(
    [
      ...drops.active.map((drop) => cellKey(drop.cell)),
      ...state.specialTiles.map((tile) => cellKey(tile.cell)),
    ],
  )
  const recent = new Set(drops.recentCells)
  const candidates = reachableDropCells().filter((cell) => !occupied.has(cellKey(cell)))
  if (candidates.length === 0) return null

  const fresh = candidates.filter((cell) => !recent.has(cellKey(cell)))
  const pool = fresh.length > 0 ? fresh : candidates
  const cell = rng.pick(pool)
  const defs = DROP_ITEM_TYPES.map((type) => ITEM_CATALOG[type])
  const picked = weightedPick(defs, () => rng.next())

  return {
    id: `drop-${state.seed}-${nowKey(state.now)}-${cellKey(cell)}`,
    itemType: picked.type,
    cell,
    spawnedAt: state.now,
    expiresAt: state.now + state.config.drops.dropLifetime,
  }
}

export function removeDropAt(state: GameState, cell: Cell): { state: GameState; drop: DropState | null } {
  const drop = state.drops.active.find((d) => d.cell.x === cell.x && d.cell.y === cell.y) ?? null
  if (!drop) return { state, drop: null }
  return {
    state: {
      ...state,
      drops: {
        ...state.drops,
        active: state.drops.active.filter((d) => d.id !== drop.id),
        phase: state.drops.active.length <= 1 ? (state.now >= state.drops.announceAt ? 'countdown' : 'idle') : 'active',
      },
    },
    drop,
  }
}

function nowKey(now: number): number {
  return Math.floor(now)
}

export function dropCountdownSeconds(state: GameState): number {
  if (state.drops.phase !== 'countdown') return 0
  return Math.max(0, Math.ceil((state.drops.nextAt - state.now) / 1000))
}
