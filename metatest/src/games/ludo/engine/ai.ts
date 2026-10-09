import type { AiStrategy, GameState, LegalMove } from './types'
import { inventoryCount } from './rules'

function scoreNormal(move: LegalMove): number {
  let score = move.stepsTo
  if (move.captures.length) score += 80
  if (move.finishes) score += 90
  if (move.entersBoard) score += 25
  if (move.landsOnDrop) score += 35
  if (move.landsOnSpecial) score += 12
  return score
}

function scoreHard(move: LegalMove): number {
  let score = move.stepsTo * 0.4
  if (move.finishes) score += 140
  if (move.captures.length) score += 110
  if (move.landsOnDrop) score += 50
  if (move.entersBoard) score += 30
  if (move.landsOnSpecial) score += 16
  return score
}

const easy: AiStrategy = {
  id: 'easy',
  chooseMove(_state, moves) {
    return moves[Math.floor(Math.random() * moves.length)]!
  },
  chooseItem() {
    return null
  },
}

const normal: AiStrategy = {
  id: 'normal',
  chooseMove(_state, moves) {
    return [...moves].sort((a, b) => scoreNormal(b) - scoreNormal(a))[0]!
  },
  chooseItem(state, moves) {
    if (moves.some((m) => m.captures.length || m.finishes)) return null
    if (inventoryCount(current(state), 'MOVE_PLUS_2') > 0) return 'MOVE_PLUS_2'
    return null
  },
}

const hard: AiStrategy = {
  id: 'hard',
  chooseMove(_state, moves) {
    return [...moves].sort((a, b) => scoreHard(b) - scoreHard(a))[0]!
  },
  chooseItem(state, moves) {
    const player = current(state)
    const hasCapture = moves.some((m) => m.captures.length || m.finishes)
    if (hasCapture) return null
    if (inventoryCount(player, 'MOVE_PLUS_4') > 0) return 'MOVE_PLUS_4'
    if (inventoryCount(player, 'MOVE_PLUS_2') > 0) return 'MOVE_PLUS_2'
    if (inventoryCount(player, 'MYSTERY') > 0) return 'MYSTERY'
    return null
  },
}

function current(state: GameState) {
  return state.players[state.currentPlayerIndex]!
}

const STRATEGIES: Record<string, AiStrategy> = { easy, normal, hard }

export function getStrategy(id: string | null | undefined): AiStrategy {
  return STRATEGIES[id ?? 'normal'] ?? normal
}
