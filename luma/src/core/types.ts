export const GAME_TITLE = 'Luma'
export const STUDIO_NAME = 'Soft Orbit'
export const GAME_WIDTH = 1280
export const GAME_HEIGHT = 720
export const TILE = 40
export const PLAYER_RADIUS = 22
export const BODY_COLOR = '#F5F1EA'
export const EYE_COLOR = '#0E0E10'

export const PHYSICS = {
  gravity: 1750,
  lowGravity: 720,
  moveSpeed: 310,
  accel: 2400,
  airAccel: 1700,
  friction: 2100,
  airFriction: 280,
  jump: 640,
  bounceJump: 780,
  wallKick: 280,
  maxFall: 1250,
  coyote: 0.1,
  jumpBuffer: 0.12,
  bounce: 0.18,
  springBoost: 1080,
  invuln: 1.05,
} as const

export type SeasonId = 'season-1' | 'season-2' | 'season-3' | 'season-4'
export type LevelKind = 'normal' | 'boss'
export type Archetype =
  | 'intro'
  | 'precision'
  | 'speed'
  | 'exploration'
  | 'puzzle'
  | 'vertical'
  | 'chase'
  | 'escape'
  | 'physics'
  | 'movers'
  | 'enemy'
  | 'boss'

export type EnemyKind =
  | 'patrol'
  | 'walker'
  | 'jumper'
  | 'flyer'
  | 'shooter'
  | 'chaser'
  | 'shielded'
  | 'virus'
  | 'environmental'

export type CollectibleKind = 'common' | 'rare' | 'secret' | 'star'

export type Dir = 'up' | 'down' | 'left' | 'right'

export interface Vec2 {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface SeasonTheme {
  id: SeasonId
  name: string
  tagline: string
  description: string
  cover: string
  background: string
  music: string
  bossMusic: string
  skyTop: number
  skyBot: number
  solid: number
  solidHi: number
  accent: number
  accent2: number
  hazard: number
  fog: number
  parallax: [number, number, number]
}

export interface UnlockRequirement {
  type: 'none' | 'season-complete' | 'stars' | 'boss'
  seasonId?: SeasonId
  stars?: number
}

export interface SeasonDef {
  id: SeasonId
  index: number
  theme: SeasonTheme
  unlock: UnlockRequirement
  levelCount: number
}

export interface PlatformDef extends Rect {
  oneWay?: boolean
  sticky?: boolean
  organic?: boolean
}

export interface MoverDef extends Rect {
  ax: number
  ay: number
  period: number
  phase?: number
  oneWay?: boolean
}

export interface SpringDef {
  x: number
  y: number
  power?: number
  dir?: Dir
}

export interface ConveyorDef extends Rect {
  speed: number
}

export interface CrusherDef extends Rect {
  ax: number
  ay: number
  period: number
  delay?: number
}

export interface LaserDef extends Rect {
  on: number
  off: number
  phase?: number
  axis: 'h' | 'v'
}

export interface GearDef {
  x: number
  y: number
  radius: number
  speed: number
}

export interface PortalDef {
  a: Vec2
  b: Vec2
}

export interface GravityZoneDef extends Rect {
  gravity: number
  flip?: boolean
}

export interface FluidDef extends Rect {
  drag: number
  toxic?: boolean
}

export interface TimedPlatformDef extends Rect {
  on: number
  off: number
  phase?: number
}

export interface CollectibleDef extends Vec2 {
  kind: CollectibleKind
  id: string
}

export interface EnemyDef extends Vec2 {
  kind: EnemyKind
  path?: number
  dir?: number
  hp?: number
}

export interface CheckpointDef extends Vec2 {
  id: string
}

export interface SecretRoomDef extends Rect {
  id: string
  reveal?: Rect
}

export interface HazardDef extends Rect {
  kind: 'spike' | 'saw' | 'thorn' | 'acid'
  dir?: Dir
}

export interface BossDef {
  kind: 'thorn-titan' | 'prime-mover' | 'grav-nexus' | 'prime-pathogen'
  x: number
  y: number
}

export interface LevelDef {
  id: string
  seasonId: SeasonId
  index: number
  kind: LevelKind
  name: string
  subtitle: string
  archetype: Archetype
  parTime: number
  world: { width: number; height: number }
  spawn: Vec2
  goal: Rect
  solids: PlatformDef[]
  platforms: PlatformDef[]
  movers: MoverDef[]
  springs: SpringDef[]
  conveyors: ConveyorDef[]
  crushers: CrusherDef[]
  lasers: LaserDef[]
  gears: GearDef[]
  portals: PortalDef[]
  gravityZones: GravityZoneDef[]
  gravityPads: Vec2[]
  fluids: FluidDef[]
  timed: TimedPlatformDef[]
  collectibles: CollectibleDef[]
  enemies: EnemyDef[]
  checkpoints: CheckpointDef[]
  secrets: SecretRoomDef[]
  hazards: HazardDef[]
  decorations: Rect[]
  boss?: BossDef
}

export interface RunStats {
  score: number
  time: number
  deaths: number
  collectibles: number
  collectiblesTotal: number
  secrets: number
  secretsTotal: number
  stars: number
  combo: number
}

export interface LevelRecord {
  completed: boolean
  stars: number
  bestScore: number
  bestTime: number
  deaths: number
  collectibles: number
  secrets: number
  secretIds: string[]
}

export interface SettingsState {
  master: number
  music: number
  sfx: number
  muted: boolean
  shake: boolean
  particles: boolean
  skipIntro: boolean
}

export interface SaveData {
  version: number
  seenIntro: boolean
  settings: SettingsState
  levels: Record<string, LevelRecord>
  unlockedSeasons: SeasonId[]
  unlockedLevels: string[]
}

export const DEFAULT_SETTINGS: SettingsState = {
  master: 0.85,
  music: 0.55,
  sfx: 0.85,
  muted: false,
  shake: true,
  particles: true,
  skipIntro: false,
}

export const EMPTY_RECORD: LevelRecord = {
  completed: false,
  stars: 0,
  bestScore: 0,
  bestTime: 0,
  deaths: 0,
  collectibles: 0,
  secrets: 0,
  secretIds: [],
}
