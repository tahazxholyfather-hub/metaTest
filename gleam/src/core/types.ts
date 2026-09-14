/** Shared typed data structures. Adding a season never requires changing these. */

export type SeasonId = string
export type LevelId = string

export type LevelArchetype =
  | 'intro'
  | 'precision'
  | 'speed'
  | 'exploration'
  | 'puzzle'
  | 'vertical'
  | 'chase'
  | 'escape'
  | 'physics'
  | 'moving'
  | 'enemy'
  | 'boss'

export type PlatformType =
  | 'solid'
  | 'oneway'
  | 'moving'
  | 'crumble'
  | 'conveyor'
  | 'sticky'
  | 'ice'
  | 'spring'
  | 'timed'
  | 'membrane'
  | 'fluid'
  | 'hidden'

export type HazardType =
  | 'spike'
  | 'laser'
  | 'crusher'
  | 'toxic'
  | 'gear'
  | 'saw'
  | 'flame'
  | 'virus-cloud'

export type EnemyKind =
  | 'patrol'
  | 'walker'
  | 'jumper'
  | 'flyer'
  | 'shooter'
  | 'chaser'
  | 'shielded'
  | 'environmental'

export type CollectibleRarity = 'common' | 'rare' | 'secret'

export type GravityMode = 'down' | 'up' | 'low' | 'zero' | 'flip'

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

export interface UnlockRequirement {
  type: 'free' | 'level' | 'season' | 'stars' | 'secrets' | 'boss'
  seasonId?: SeasonId
  levelId?: LevelId
  stars?: number
  secrets?: number
}

export interface ThemePalette {
  id: string
  skyTop: string
  skyBottom: string
  fog: string
  mid: string
  ground: string
  accent: string
  accent2: string
  hazard: string
  collectible: string
  secret: string
  platform: string
  platformEdge: string
  shadow: string
  ui: string
}

export interface MovePath {
  dx: number
  dy: number
  period: number
  phase?: number
  ease?: 'sine' | 'linear'
}

export interface PlatformDef {
  x: number
  y: number
  w: number
  h: number
  type: PlatformType
  move?: MovePath
  dir?: 1 | -1
  speed?: number
  period?: number
  delay?: number
  spring?: number
  visible?: boolean
}

export interface HazardDef {
  x: number
  y: number
  w: number
  h: number
  type: HazardType
  move?: MovePath
  period?: number
  delay?: number
  angle?: number
  onMs?: number
  offMs?: number
}

export interface EnemyDef {
  x: number
  y: number
  kind: EnemyKind
  variant?: string
  patrol?: number
  hp?: number
  flipGravity?: boolean
}

export interface CollectibleDef {
  x: number
  y: number
  rarity: CollectibleRarity
  id?: string
}

export interface CheckpointDef {
  x: number
  y: number
  id: string
}

export interface PortalDef {
  id: string
  x: number
  y: number
  w: number
  h: number
  targetId: string
  retainVelocity?: boolean
  rotate?: number
}

export interface ZoneDef {
  x: number
  y: number
  w: number
  h: number
  gravity?: GravityMode
  fluid?: boolean
  sticky?: boolean
  toxic?: boolean
  lowDrag?: boolean
}

export interface SecretRoomDef {
  id: string
  x: number
  y: number
  w: number
  h: number
  hint?: string
}

export interface DecorationDef {
  x: number
  y: number
  kind: string
  scale?: number
  flip?: boolean
}

export interface ObjectiveDef {
  type: 'reach-goal' | 'defeat-boss' | 'collect-all' | 'survive'
  amount?: number
}

export interface BossPhaseDef {
  hp: number
  name: string
  telegraph: string
}

export interface BossDef {
  kind: 'grove-guardian' | 'gear-titan' | 'gravity-warden' | 'prime-virus'
  x: number
  y: number
  phases: BossPhaseDef[]
}

export interface LevelDef {
  id: LevelId
  seasonId: SeasonId
  index: number
  name: string
  subtitle?: string
  archetype: LevelArchetype
  isBoss: boolean
  parTime: number
  tile: number
  width: number
  height: number
  spawn: Vec2
  goal: Rect
  platforms: PlatformDef[]
  hazards: HazardDef[]
  enemies: EnemyDef[]
  collectibles: CollectibleDef[]
  checkpoints: CheckpointDef[]
  portals: PortalDef[]
  zones: ZoneDef[]
  secrets: SecretRoomDef[]
  decorations: DecorationDef[]
  boss?: BossDef
  camera?: { zoom?: number; boundsPad?: number }
  intro?: string
  easterEgg?: string
}

export interface SeasonDef {
  id: SeasonId
  index: number
  name: string
  shortName: string
  description: string
  cover: string
  background?: string
  theme: ThemePalette
  music: { world: string; boss: string }
  ambient?: string
  unlock: UnlockRequirement
  levels: LevelDef[]
}

export interface LevelRecord {
  completed: boolean
  bestScore: number
  bestTime: number
  deaths: number
  stars: number
  collectibles: number
  collectiblesMax: number
  secrets: number
  secretsMax: number
  played: boolean
}

export interface SaveData {
  version: number
  firstLaunchDone: boolean
  settings: SettingsData
  records: Record<LevelId, LevelRecord>
  unlockedSeasons: SeasonId[]
  unlockedLevels: LevelId[]
  totals: {
    score: number
    stars: number
    deaths: number
    playTime: number
  }
  lastPlayed?: { seasonId: SeasonId; levelId: LevelId }
}

export interface SettingsData {
  master: number
  music: number
  sfx: number
  muted: boolean
  shake: boolean
  particles: boolean
  reduceMotion: boolean
  leftHanded: boolean
}

export interface RunStats {
  score: number
  time: number
  deaths: number
  collectibles: number
  collectiblesMax: number
  rares: number
  secrets: number
  secretsMax: number
  combo: number
  maxCombo: number
}

export interface LevelCompletePayload {
  level: LevelDef
  stats: RunStats
  stars: number
  prevStars: number
  bestScore: number
  bestTime: number
  newBestScore: boolean
  newBestTime: boolean
  unlockedNext: boolean
  unlockedSeason?: SeasonId
}

export const DEFAULT_SETTINGS: SettingsData = {
  master: 0.85,
  music: 0.7,
  sfx: 0.85,
  muted: false,
  shake: true,
  particles: true,
  reduceMotion: false,
  leftHanded: false,
}

export const TILE = 40
export const PLAYER_RADIUS = 18
