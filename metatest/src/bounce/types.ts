import type { Grid } from './tiles'

export type ThemeId = 'meadow' | 'canyon' | 'cove' | 'ridge' | 'dusk'

export type Axis = 'x' | 'y'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface CoinDef {
  kind: 'coin'
  id: string
  x: number
  y: number
  secret?: boolean
}

export interface CheckpointDef {
  kind: 'checkpoint'
  id: string
  x: number
  y: number
}

export interface GoalDef {
  kind: 'goal'
  x: number
  y: number
  w: number
  h: number
}

export interface SwitchDef {
  kind: 'switch'
  id: string
  x: number
  y: number
  w: number
  h: number
  targets: string[]
  mode: 'once' | 'toggle' | 'hold'
}

export interface GateDef {
  kind: 'gate'
  id: string
  x: number
  y: number
  w: number
  h: number
  open?: boolean
}

export interface PlatformDef {
  kind: 'platform'
  x: number
  y: number
  w: number
  h: number
  axis: Axis
  distance: number
  period: number
  phase?: number
}

export interface HazardDef {
  kind: 'hazard'
  x: number
  y: number
  w: number
  h: number
  axis: Axis
  distance: number
  period: number
  phase?: number
}

export interface ZoneDef {
  kind: 'zone'
  id: string
  x: number
  y: number
  w: number
  h: number
  secret?: boolean
  route?: string
}

export type LevelObject =
  | CoinDef
  | CheckpointDef
  | GoalDef
  | SwitchDef
  | GateDef
  | PlatformDef
  | HazardDef
  | ZoneDef

export interface LevelDef {
  id: string
  name: string
  number: number
  theme: ThemeId
  grid: Grid
  spawn: { x: number; y: number }
  objects: LevelObject[]
  /** Camera limits in pixels. Defaults to the full grid. */
  camera?: Rect
}

export interface InputFrame {
  x: number
  jumpHeld: boolean
  jumpPressed: boolean
  jumpReleased: boolean
}

export const IDLE_INPUT: InputFrame = {
  x: 0,
  jumpHeld: false,
  jumpPressed: false,
  jumpReleased: false,
}

export type DeathReason = 'spike' | 'hazard' | 'drown' | 'fall'

export type SimEvent =
  | { type: 'jump' }
  | { type: 'land'; speed: number }
  | { type: 'bounce' }
  | { type: 'collect'; id: string; secret: boolean }
  | { type: 'checkpoint'; id: string }
  | { type: 'switch'; id: string; on: boolean }
  | { type: 'secret'; id: string }
  | { type: 'route'; id: string }
  | { type: 'goal' }
  | { type: 'die'; reason: DeathReason }
  | { type: 'splash' }

export interface FloorHit {
  x: number
  y: number
  nx: number
  ny: number
  dy: number
  bounce: boolean
  platform: number
}
