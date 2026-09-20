import { FINISH_STEPS } from './config'
import { cellForSteps, cellsEqual, isSafeLocation, pathBetween, startCell, tokenCell } from './board'
import type { DropState, GameState, ItemType, LegalMove, PlayerState, TokenState } from './types'

export function currentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex]!
}

export function allTokens(state: GameState): TokenState[] {
  return state.players.flatMap((player) => player.tokens)
}

export function findToken(state: GameState, tokenId: string): TokenState | null {
  for (const player of state.players) {
    const token = player.tokens.find((t) => t.id === tokenId)
    if (token) return token
  }
  return null
}

export function playerByToken(state: GameState, tokenId: string): PlayerState | null {
  return state.players.find((player) => player.tokens.some((t) => t.id === tokenId)) ?? null
}

export function effectiveDice(state: GameState): number | null {
  if (state.diceValue == null) return null
  return state.diceValue + state.moveBonus
}

export function tokensOnCell(state: GameState, token: TokenState, cell = tokenCell(token)): TokenState[] {
  return allTokens(state).filter((other) => {
    if (other.id === token.id) return false
    if (other.location.kind === 'home' || other.location.kind === 'finished') return false
    return cellsEqual(tokenCell(other), cell)
  })
}

export function capturesOnLanding(state: GameState, mover: TokenState, destSteps: number): string[] {
  const dest = cellForSteps(mover.color, destSteps)
  const destLocation = { kind: 'track' as const, steps: destSteps }
  if (isSafeLocation(mover.color, destLocation)) return []
  return tokensOnCell(state, mover, dest)
    .filter((other) => other.color !== mover.color && !isSafeLocation(other.color, other.location))
    .map((other) => other.id)
}

export function getLegalMoves(state: GameState, player: PlayerState = currentPlayer(state)): LegalMove[] {
  const dice = effectiveDice(state)
  if (dice == null || dice <= 0) return []

  const moves: LegalMove[] = []
  for (const token of player.tokens) {
    const move = legalMoveForToken(state, token, dice)
    if (move) moves.push(move)
  }
  return moves
}

export function legalMoveForToken(state: GameState, token: TokenState, dice: number): LegalMove | null {
  if (token.location.kind === 'finished') return null

  if (token.location.kind === 'home') {
    if (dice !== 6 && state.moveBonus === 0) return null
    if (dice < 1) return null
    // A 6 (or a bonus-boosted roll that still lets us leave) places the token on start.
    // If the player used +2/+4 without a 6, they still cannot leave home.
    if (state.diceValue !== 6) return null
    const start = startCell(token.color)
    const captures = capturesOnLanding(state, token, 0)
    return {
      tokenId: token.id,
      stepsFrom: -1,
      stepsTo: 0,
      path: [start],
      captures,
      entersBoard: true,
      finishes: false,
      landsOnDrop: dropAt(state, start),
      landsOnSpecial: specialAt(state, start),
    }
  }

  const from = token.location.steps
  const to = from + dice
  if (to > FINISH_STEPS) return null
  const path = pathBetween(token.color, from, dice)
  if (!path) return null
  const dest = path[path.length - 1]!
  return {
    tokenId: token.id,
    stepsFrom: from,
    stepsTo: to,
    path,
    captures: capturesOnLanding(state, token, to),
    entersBoard: false,
    finishes: to === FINISH_STEPS,
    landsOnDrop: dropAt(state, dest),
    landsOnSpecial: specialAt(state, dest),
  }
}

export function dropAt(state: GameState, cell: { x: number; y: number }): DropState | null {
  return state.drops.active.find((drop) => cellsEqual(drop.cell, cell)) ?? null
}

export function specialAt(state: GameState, cell: { x: number; y: number }) {
  return state.specialTiles.find((tile) => cellsEqual(tile.cell, cell)) ?? null
}

export function hasWon(player: PlayerState): boolean {
  return player.tokens.every((token) => token.location.kind === 'finished')
}

export function finishedCount(player: PlayerState): number {
  return player.tokens.filter((token) => token.location.kind === 'finished').length
}

export function nextPlayerIndex(state: GameState): number {
  return (state.currentPlayerIndex + 1) % state.players.length
}

export function inventoryCount(player: PlayerState, type: ItemType): number {
  return player.inventory.find((stack) => stack.type === type)?.count ?? 0
}

export function isHumanTurn(state: GameState): boolean {
  return currentPlayer(state).kind === 'human'
}
