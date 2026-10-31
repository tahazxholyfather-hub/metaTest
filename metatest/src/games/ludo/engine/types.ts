export type PlayerColor = 'blue' | 'yellow' | 'red' | 'green'

export type PlayerKind = 'human' | 'ai'

export type AiDifficulty = 'easy' | 'normal' | 'hard'

export type GameMode = 'single' | 'local'

export type TokenStatus =
  | 'HOME_IDLE'
  | 'HOME_SLEEP'
  | 'ENTERING'
  | 'IDLE'
  | 'SELECTABLE'
  | 'MOVING'
  | 'LANDING'
  | 'NEAR_ENEMY'
  | 'ATTACKING'
  | 'CAPTURING'
  | 'CAPTURED'
  | 'RETURNING_HOME'
  | 'BONUS_RECEIVED'
  | 'BONUS_ACTIVE'
  | 'WINNING'

export type TurnPhase =
  | 'waiting_roll'
  | 'waiting_select'
  | 'animating'
  | 'game_over'

export type ItemType =
  | 'COIN'
  | 'XP'
  | 'POINT'
  | 'MOVE_PLUS_2'
  | 'MOVE_PLUS_4'
  | 'MUSIC'
  | 'MYSTERY'
  | 'SCIENCE_FACT'
  | 'QUESTION'

export type ItemRarity = 'common' | 'uncommon' | 'rare'

export type ItemCollection = 'instant' | 'inventory'

export type Cell = { x: number; y: number }

export type TokenLocation =
  | { kind: 'home'; slot: number }
  | { kind: 'track'; steps: number }
  | { kind: 'finished' }

export interface TokenState {
  id: string
  color: PlayerColor
  index: number
  location: TokenLocation
  status: TokenStatus
}

export interface InventoryStack {
  type: ItemType
  count: number
}

export interface PlayerState {
  id: string
  name: string
  color: PlayerColor
  kind: PlayerKind
  difficulty: AiDifficulty | null
  tokens: TokenState[]
  inventory: InventoryStack[]
  coins: number
  xp: number
  points: number
}

export interface DropState {
  id: string
  itemType: ItemType
  cell: Cell
  spawnedAt: number
  expiresAt: number
}

export type DropPhase = 'idle' | 'countdown' | 'active'

export interface DropSchedulerState {
  phase: DropPhase
  nextAt: number
  announceAt: number
  active: DropState[]
  recentCells: string[]
}

export type SpecialTileKind = Exclude<ItemType, 'MOVE_PLUS_2' | 'MOVE_PLUS_4' | 'MYSTERY'>

export interface SpecialTile {
  cell: Cell
  kind: SpecialTileKind
}

export interface ScienceFact {
  id: string
  category: string
  title: string
  body: string
}

export interface ScienceQuestion {
  id: string
  category: string
  prompt: string
  options: [string, string]
  correctIndex: 0 | 1
  fact: string
}

export interface GameConfig {
  drops: {
    dropIntervalMin: number
    dropIntervalMax: number
    dropLifetime: number
    maxActiveDrops: number
    announceLead: number
  }
  animation: {
    stepMs: number
    landingMs: number
    captureMs: number
    returnHomeMs: number
    collectMs: number
    diceSpinMs: number
  }
  ai: {
    preRollMs: number
    thinkMinMs: number
    thinkMaxMs: number
  }
}

export interface GameState {
  id: string
  seed: number
  mode: GameMode
  config: GameConfig
  players: PlayerState[]
  currentPlayerIndex: number
  turnPhase: TurnPhase
  diceValue: number | null
  consecutiveSixes: number
  moveBonus: number
  legalTokenIds: string[]
  selectedTokenId: string | null
  specialTiles: SpecialTile[]
  drops: DropSchedulerState
  winnerId: string | null
  turnNumber: number
  now: number
  activeFact: ScienceFact | null
  activeQuestion: ScienceQuestion | null
  lastRollWasSix: boolean
}

export interface MatchSetup {
  mode: GameMode
  humanColor: PlayerColor
  playerCount: 2 | 3 | 4
  difficulty: AiDifficulty
  names?: Partial<Record<PlayerColor, string>>
  seed?: number
  config?: DeepPartial<GameConfig>
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export interface LegalMove {
  tokenId: string
  stepsFrom: number
  stepsTo: number
  path: Cell[]
  captures: string[]
  entersBoard: boolean
  finishes: boolean
  landsOnDrop: DropState | null
  landsOnSpecial: SpecialTile | null
}

export interface GameItemDefinition {
  type: ItemType
  title: string
  description: string
  rarity: ItemRarity
  spawnWeight: number
  stackable: boolean
  consumeOnUse: boolean
  collection: ItemCollection
  duration: number | null
}

export type GameEventType =
  | 'TURN_STARTED'
  | 'TURN_ENDED'
  | 'DICE_ROLLED'
  | 'TOKEN_SELECTED'
  | 'TOKEN_MOVED'
  | 'TOKEN_LANDED'
  | 'TOKEN_CAPTURED'
  | 'TOKEN_ENTERING'
  | 'TOKEN_RETURNING_HOME'
  | 'ITEM_SPAWNED'
  | 'ITEM_COLLECTED'
  | 'ITEM_USED'
  | 'ITEM_EXPIRED'
  | 'BONUS_ACTIVATED'
  | 'SCIENCE_FACT_OPENED'
  | 'MUSIC_STARTED'
  | 'DROP_ANNOUNCED'
  | 'PLAYER_WON'
  | 'QUESTION_OPENED'

export interface GameEvent {
  type: GameEventType
  at: number
  playerId?: string
  tokenId?: string
  payload?: Record<string, unknown>
}

export interface AnimationBridge {
  wait(ms: number): Promise<void>
  waitStep(tokenId: string, stepIndex: number, cell: Cell): Promise<void>
}

export interface AiStrategy {
  id: AiDifficulty
  chooseMove(state: GameState, moves: LegalMove[]): LegalMove
  chooseItem(state: GameState, moves: LegalMove[]): ItemType | null
}
