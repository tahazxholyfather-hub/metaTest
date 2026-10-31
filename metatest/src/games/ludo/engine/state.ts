import { mergeConfig, TOKENS_PER_PLAYER } from './config'
import { SeededRng, seedFrom } from './rng'
import { cellKey, colorsForPlayerCount, MAIN_PATH, startCell } from './board'
import { SPECIAL_TILE_KINDS } from './catalog'
import { scheduleFirstDrop } from './drops'
import type { GameState, MatchSetup, PlayerColor, PlayerState, SpecialTile, TokenState } from './types'

const AI_NAMES: Record<PlayerColor, string> = {
  blue: 'Reza',
  yellow: 'Sara',
  green: 'Nika',
  red: 'Alex',
}

export function createMatch(setup: MatchSetup, now = 0): GameState {
  const seed = seedFrom(setup.seed)
  const rng = new SeededRng(seed)
  const config = mergeConfig(setup.config)
  const colors = colorsForPlayerCount(setup.playerCount, setup.humanColor)

  const players: PlayerState[] = colors.map((color, index) => {
    const isHuman = setup.mode === 'local' ? true : color === setup.humanColor
    const defaultName = isHuman ? (setup.names?.[color] ?? (index === 0 ? 'You' : AI_NAMES[color])) : AI_NAMES[color]
    return {
      id: `player-${color}`,
      name: setup.names?.[color] ?? defaultName,
      color,
      kind: isHuman ? 'human' : 'ai',
      difficulty: isHuman ? null : setup.difficulty,
      tokens: makeTokens(color),
      inventory: [],
      coins: 0,
      xp: 0,
      points: 0,
    }
  })

  return {
    id: `match-${seed}`,
    seed,
    mode: setup.mode,
    config,
    players,
    currentPlayerIndex: 0,
    turnPhase: 'waiting_roll',
    diceValue: null,
    consecutiveSixes: 0,
    moveBonus: 0,
    legalTokenIds: [],
    selectedTokenId: null,
    specialTiles: placeSpecialTiles(rng),
    drops: scheduleFirstDrop(rng, now, config),
    winnerId: null,
    turnNumber: 1,
    now,
    activeFact: null,
    activeQuestion: null,
    lastRollWasSix: false,
  }
}

function makeTokens(color: PlayerColor): TokenState[] {
  return Array.from({ length: TOKENS_PER_PLAYER }, (_, index) => ({
    id: `${color}-${index}`,
    color,
    index,
    location: { kind: 'home', slot: index },
    status: index === 0 ? 'HOME_IDLE' : 'HOME_SLEEP',
  }))
}

function placeSpecialTiles(rng: SeededRng): SpecialTile[] {
  const starts = new Set(
    (['blue', 'yellow', 'green', 'red'] as const).map((color) => cellKey(startCell(color))),
  )
  const pool = rng.shuffle(MAIN_PATH.filter((cell) => !starts.has(cellKey(cell))))
  const count = 5
  const tiles: SpecialTile[] = []
  for (let i = 0; i < count && i < pool.length; i++) {
    tiles.push({
      cell: pool[i]!,
      kind: rng.pick(SPECIAL_TILE_KINDS),
    })
  }
  return tiles
}
