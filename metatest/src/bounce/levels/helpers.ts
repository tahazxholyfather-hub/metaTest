import { TILE } from '../config'
import type { CheckpointDef, CoinDef, GateDef, GoalDef, HazardDef, PlatformDef, SwitchDef, ZoneDef } from '../types'

export function coin(id: string, col: number, surface: number, lift = 0.72, secret = false): CoinDef {
  return {
    kind: 'coin',
    id,
    x: (col + 0.5) * TILE,
    y: surface * TILE - lift * TILE,
    secret,
  }
}

export function checkpoint(id: string, col: number, surface: number): CheckpointDef {
  return { kind: 'checkpoint', id, x: (col + 0.5) * TILE, y: surface * TILE }
}

export function goal(col: number, surface: number): GoalDef {
  return {
    kind: 'goal',
    x: col * TILE,
    y: surface * TILE - TILE * 2.7,
    w: TILE * 1.35,
    h: TILE * 2.7,
  }
}

export function sw(
  id: string,
  col: number,
  surface: number,
  targets: string[],
  mode: SwitchDef['mode'] = 'once',
): SwitchDef {
  return {
    kind: 'switch',
    id,
    x: col * TILE + 6,
    y: surface * TILE - 22,
    w: TILE - 12,
    h: 24,
    targets,
    mode,
  }
}

export function gate(id: string, col: number, surface: number, tiles = 3, open = false): GateDef {
  const h = tiles * TILE
  return {
    kind: 'gate',
    id,
    x: col * TILE + TILE * 0.28,
    y: surface * TILE - h,
    w: TILE * 0.44,
    h,
    open,
  }
}

export function mover(
  kind: 'platform' | 'hazard',
  col: number,
  row: number,
  w: number,
  h: number,
  axis: 'x' | 'y',
  distance: number,
  period: number,
  phase = 0,
): PlatformDef | HazardDef {
  return {
    kind,
    x: col * TILE,
    y: row * TILE,
    w: w * TILE,
    h: h * TILE,
    axis,
    distance: distance * TILE,
    period,
    phase,
  }
}

export function zone(
  id: string,
  col: number,
  row: number,
  w: number,
  h: number,
  route: string,
  secret = false,
): ZoneDef {
  return {
    kind: 'zone',
    id,
    x: col * TILE,
    y: row * TILE,
    w: w * TILE,
    h: h * TILE,
    route,
    secret,
  }
}
