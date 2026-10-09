import { getStrategy } from './ai'
import { cellForSteps, chebyshev, tokenCell } from './board'
import { ITEM_CATALOG, SCIENCE_FACTS, SCIENCE_QUESTIONS, weightedPick } from './catalog'
import { MAX_CONSECUTIVE_SIXES } from './config'
import { dropCountdownSeconds, removeDropAt, tickDrops } from './drops'
import { SeededRng } from './rng'
import {
  currentPlayer,
  dropAt,
  findToken,
  getLegalMoves,
  hasWon,
  nextPlayerIndex,
} from './rules'
import { createMatch } from './state'
import type {
  AnimationBridge,
  Cell,
  GameEvent,
  GameState,
  ItemType,
  LegalMove,
  MatchSetup,
  PlayerState,
  TokenState,
} from './types'

const instantBridge: AnimationBridge = {
  wait: async () => undefined,
  waitStep: async () => undefined,
}

export type GameListener = (snapshot: GameState, events: GameEvent[]) => void

export class GameRuntime {
  private state: GameState
  private readonly rng: SeededRng
  private readonly listeners = new Set<GameListener>()
  private bridge: AnimationBridge
  private chain: Promise<void> = Promise.resolve()
  private disposed = false
  private announcedDropAt = 0

  constructor(setup: MatchSetup, now = 0, bridge: AnimationBridge = instantBridge) {
    this.state = createMatch(setup, now)
    this.rng = new SeededRng(this.state.seed ^ 0x9e3779b9)
    this.bridge = bridge
    this.emit({ type: 'TURN_STARTED', playerId: currentPlayer(this.state).id })
    this.refreshProximity()
  }

  setBridge(bridge: AnimationBridge): void {
    this.bridge = bridge
  }

  getState(): GameState {
    return this.state
  }

  subscribe(listener: GameListener): () => void {
    this.listeners.add(listener)
    listener(this.state, [])
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    this.disposed = true
    this.listeners.clear()
  }

  tick(now: number): void {
    if (this.disposed || this.state.winnerId) return
    this.state = { ...this.state, now }
    const beforePhase = this.state.drops.phase
    const result = tickDrops(this.state, this.rng)
    this.state = result.state
    if (result.announced && this.announcedDropAt !== this.state.drops.announceAt) {
      this.announcedDropAt = this.state.drops.announceAt
      this.emit({ type: 'DROP_ANNOUNCED', payload: { seconds: dropCountdownSeconds(this.state) } })
    }
    for (const drop of result.spawned) {
      this.emit({ type: 'ITEM_SPAWNED', payload: { dropId: drop.id, itemType: drop.itemType, cell: drop.cell } })
    }
    for (const drop of result.expired) {
      this.emit({ type: 'ITEM_EXPIRED', payload: { dropId: drop.id, itemType: drop.itemType } })
    }
    if (result.spawned.length || result.expired.length || result.announced || beforePhase !== this.state.drops.phase) {
      this.flush([])
    }
  }

  rollDice(forced?: number): Promise<void> {
    return this.enqueue(() => this.rollDiceNow(forced))
  }

  selectToken(tokenId: string): Promise<void> {
    return this.enqueue(() => this.selectTokenNow(tokenId))
  }

  useItem(type: ItemType): Promise<boolean> {
    let used = false
    return this.enqueue(() => {
      used = this.useItemNow(type)
    }).then(() => used)
  }

  dismissOverlay(): void {
    if (!this.state.activeFact && !this.state.activeQuestion) return
    this.state = { ...this.state, activeFact: null, activeQuestion: null }
    this.flush([])
  }

  answerQuestion(index: number): void {
    const question = this.state.activeQuestion
    if (!question) return
    const player = currentPlayer(this.state)
    const correct = index === question.correctIndex
    this.state = {
      ...this.state,
      activeQuestion: null,
      activeFact: {
        id: `${question.id}-fact`,
        category: question.category,
        title: correct ? 'Correct' : 'Close',
        body: question.fact,
      },
      players: this.state.players.map((p) =>
        p.id === player.id && correct ? { ...p, xp: p.xp + 12, points: p.points + 4 } : p,
      ),
    }
    this.flush([])
  }

  async startAiLoop(): Promise<void> {
    if (currentPlayer(this.state).kind === 'ai') {
      await this.enqueue(() => this.playAiTurn())
    }
  }

  private enqueue(work: () => Promise<void> | void): Promise<void> {
    const run = this.chain.then(() => {
      if (this.disposed) return
      return work()
    })
    this.chain = run.then(() => undefined).catch(() => undefined)
    return run
  }

  private async rollDiceNow(forced?: number): Promise<void> {
    if (this.state.turnPhase !== 'waiting_roll' || this.state.winnerId) return
    const player = currentPlayer(this.state)
    const value = forced ?? this.rng.int(1, 6)
    const consecutive = value === 6 ? this.state.consecutiveSixes + 1 : 0

    this.state = {
      ...this.state,
      diceValue: value,
      consecutiveSixes: consecutive,
      lastRollWasSix: value === 6,
    }
    this.emit({ type: 'DICE_ROLLED', playerId: player.id, payload: { value, bonus: this.state.moveBonus } })

    if (consecutive >= MAX_CONSECUTIVE_SIXES) {
      await this.bridge.wait(this.state.config.animation.landingMs)
      this.state = { ...this.state, diceValue: null, consecutiveSixes: 0, moveBonus: 0, legalTokenIds: [] }
      await this.advanceTurn()
      return
    }

    const moves = getLegalMoves(this.state)
    this.state = {
      ...this.state,
      legalTokenIds: moves.map((m) => m.tokenId),
      turnPhase: moves.length ? 'waiting_select' : 'waiting_roll',
      players: this.markSelectable(this.state.players, moves),
    }
    this.flush([])

    if (!moves.length) {
      await this.bridge.wait(this.state.config.animation.landingMs + 120)
      if (value === 6) {
        this.state = { ...this.state, diceValue: null, moveBonus: 0, legalTokenIds: [], turnPhase: 'waiting_roll' }
        this.flush([])
        if (player.kind === 'ai') await this.playAiTurn()
      } else {
        await this.advanceTurn()
      }
    }
  }

  private async selectTokenNow(tokenId: string): Promise<void> {
    if (this.state.turnPhase !== 'waiting_select' || this.state.winnerId) return
    const moves = getLegalMoves(this.state)
    const move = moves.find((m) => m.tokenId === tokenId)
    if (!move) return
    await this.executeMove(move)
  }

  private async executeMove(move: LegalMove): Promise<void> {
    const token = findToken(this.state, move.tokenId)
    if (!token) return
    const player = currentPlayer(this.state)

    this.state = {
      ...this.state,
      turnPhase: 'animating',
      selectedTokenId: token.id,
      players: this.mapToken(this.state.players, token.id, (t) => ({
        ...t,
        status: move.entersBoard ? 'ENTERING' : 'MOVING',
      })),
    }
    this.emit({ type: 'TOKEN_SELECTED', playerId: player.id, tokenId: token.id })

    if (move.entersBoard) {
      this.emit({ type: 'TOKEN_ENTERING', playerId: player.id, tokenId: token.id })
      await this.bridge.wait(90)
    }

    for (let i = 0; i < move.path.length; i++) {
      const cell = move.path[i]!
      const steps = move.entersBoard ? 0 : move.stepsFrom + i + 1
      this.state = {
        ...this.state,
        players: this.mapToken(this.state.players, token.id, (t) => ({
          ...t,
          location: { kind: 'track', steps },
          status: i === move.path.length - 1 && move.captures.length ? 'ATTACKING' : 'MOVING',
        })),
      }
      this.emit({
        type: 'TOKEN_MOVED',
        playerId: player.id,
        tokenId: token.id,
        payload: { cell, step: i, total: move.path.length },
      })
      this.refreshProximity()
      await this.bridge.waitStep(token.id, i, cell)
    }

    if (move.finishes) {
      this.state = {
        ...this.state,
        players: this.mapToken(this.state.players, token.id, (t) => ({
          ...t,
          location: { kind: 'finished' },
          status: 'WINNING',
        })),
      }
    } else {
      this.state = {
        ...this.state,
        players: this.mapToken(this.state.players, token.id, (t) => ({
          ...t,
          status: 'LANDING',
        })),
      }
    }

    this.emit({ type: 'TOKEN_LANDED', playerId: player.id, tokenId: token.id, payload: { cell: move.path[move.path.length - 1] } })
    await this.bridge.wait(this.state.config.animation.landingMs)

    if (move.captures.length) {
      await this.resolveCaptures(token, move.captures)
    }

    const landed = findToken(this.state, token.id)
    if (landed) await this.resolveLandingRewards(landed)

    const latest = findToken(this.state, token.id)
    if (latest && latest.location.kind === 'track' && latest.status !== 'WINNING') {
      this.state = {
        ...this.state,
        players: this.mapToken(this.state.players, token.id, (t) => ({ ...t, status: 'IDLE' })),
      }
    }

    const acting = this.state.players.find((p) => p.id === player.id)!
    if (hasWon(acting)) {
      this.state = {
        ...this.state,
        winnerId: acting.id,
        turnPhase: 'game_over',
        diceValue: null,
        legalTokenIds: [],
        selectedTokenId: null,
        players: this.state.players.map((p) => ({
          ...p,
          tokens: p.tokens.map((t) => ({
            ...t,
            status: p.id === acting.id ? 'WINNING' : t.status,
          })),
        })),
      }
      this.emit({ type: 'PLAYER_WON', playerId: acting.id })
      this.flush([])
      return
    }

    const extra = this.state.lastRollWasSix
    this.state = {
      ...this.state,
      diceValue: null,
      moveBonus: 0,
      legalTokenIds: [],
      selectedTokenId: null,
      players: this.clearSelectable(this.state.players),
    }
    this.refreshProximity()

    if (extra) {
      this.state = { ...this.state, turnPhase: 'waiting_roll' }
      this.flush([])
      if (acting.kind === 'ai') await this.playAiTurn()
    } else {
      await this.advanceTurn()
    }
  }

  private async resolveCaptures(attacker: TokenState, capturedIds: string[]): Promise<void> {
    for (const id of capturedIds) {
      const victim = findToken(this.state, id)
      if (!victim) continue
      this.state = {
        ...this.state,
        players: this.mapToken(this.state.players, id, (t) => ({ ...t, status: 'CAPTURED' })),
      }
      this.emit({
        type: 'TOKEN_CAPTURED',
        playerId: currentPlayer(this.state).id,
        tokenId: attacker.id,
        payload: { victimId: id },
      })
      await this.bridge.wait(this.state.config.animation.captureMs)

      this.state = {
        ...this.state,
        players: this.mapToken(this.state.players, id, (t) => ({ ...t, status: 'RETURNING_HOME' })),
      }
      this.emit({ type: 'TOKEN_RETURNING_HOME', tokenId: id })
      await this.bridge.wait(this.state.config.animation.returnHomeMs)

      this.state = {
        ...this.state,
        players: this.mapToken(this.state.players, id, (t) => ({
          ...t,
          location: { kind: 'home', slot: t.index },
          status: 'HOME_SLEEP',
        })),
      }
    }
    this.state = {
      ...this.state,
      players: this.mapToken(this.state.players, attacker.id, (t) => ({ ...t, status: 'CAPTURING' })),
    }
    await this.bridge.wait(180)
  }

  private async resolveLandingRewards(token: TokenState): Promise<void> {
    if (token.location.kind !== 'track') return
    const cell = cellForSteps(token.color, token.location.steps)
    const drop = dropAt(this.state, cell)
    if (drop) {
      const removed = removeDropAt(this.state, cell)
      this.state = removed.state
      this.applyReward(token.color, drop.itemType, { fromDrop: true, cell })
      this.state = {
        ...this.state,
        players: this.mapToken(this.state.players, token.id, (t) => ({ ...t, status: 'BONUS_RECEIVED' })),
      }
      await this.bridge.wait(this.state.config.animation.collectMs)
    }

    const special = this.state.specialTiles.find((tile) => tile.cell.x === cell.x && tile.cell.y === cell.y)
    if (special) {
      this.state = {
        ...this.state,
        specialTiles: this.state.specialTiles.filter((tile) => tile !== special),
      }
      this.applyReward(token.color, special.kind, { fromDrop: false, cell })
    }
  }

  private applyReward(color: TokenState['color'], type: ItemType, meta: { fromDrop: boolean; cell: Cell }): void {
    const player = this.state.players.find((p) => p.color === color)!
    const def = ITEM_CATALOG[type]
    let next = player

    if (def.collection === 'instant') {
      if (type === 'COIN') next = { ...next, coins: next.coins + 1 }
      if (type === 'XP') next = { ...next, xp: next.xp + 8 }
      if (type === 'POINT') next = { ...next, points: next.points + 5 }
      if (type === 'SCIENCE_FACT') {
        const fact = this.rng.pick(SCIENCE_FACTS)
        this.state = { ...this.state, activeFact: fact }
        this.emit({ type: 'SCIENCE_FACT_OPENED', playerId: player.id, payload: { factId: fact.id } })
      }
      if (type === 'QUESTION') {
        const question = this.rng.pick(SCIENCE_QUESTIONS)
        this.state = { ...this.state, activeQuestion: question }
        this.emit({ type: 'QUESTION_OPENED', playerId: player.id, payload: { questionId: question.id } })
      }
    } else {
      next = addInventory(next, type)
    }

    this.state = {
      ...this.state,
      players: this.state.players.map((p) => (p.id === player.id ? next : p)),
    }
    this.emit({
      type: 'ITEM_COLLECTED',
      playerId: player.id,
      payload: { itemType: type, cell: meta.cell, fromDrop: meta.fromDrop, name: player.name },
    })
  }

  private useItemNow(type: ItemType): boolean {
    if (this.state.winnerId) return false
    if (this.state.turnPhase === 'animating' || this.state.turnPhase === 'game_over') return false
    const player = currentPlayer(this.state)
    if (player.kind !== 'human' && player.kind !== 'ai') return false
    const stack = player.inventory.find((s) => s.type === type)
    if (!stack || stack.count <= 0) return false

    let consumed = true
    if (type === 'MOVE_PLUS_2') this.state = { ...this.state, moveBonus: this.state.moveBonus + 2 }
    else if (type === 'MOVE_PLUS_4') this.state = { ...this.state, moveBonus: this.state.moveBonus + 4 }
    else if (type === 'MUSIC') this.emit({ type: 'MUSIC_STARTED', playerId: player.id })
    else if (type === 'MYSTERY') this.openMystery(player)
    else if (type === 'XP') {
      this.state = {
        ...this.state,
        players: this.state.players.map((p) => (p.id === player.id ? { ...p, xp: p.xp + 10 } : p)),
      }
    } else {
      consumed = false
    }

    if (!consumed) return false

    this.state = {
      ...this.state,
      players: this.state.players.map((p) => (p.id === player.id ? removeInventory(p, type) : p)),
    }

    if (this.state.turnPhase === 'waiting_select') {
      const moves = getLegalMoves(this.state)
      this.state = {
        ...this.state,
        legalTokenIds: moves.map((m) => m.tokenId),
        players: this.markSelectable(this.state.players, moves),
      }
    }

    this.emit({ type: 'ITEM_USED', playerId: player.id, payload: { itemType: type } })
    if (type === 'MOVE_PLUS_2' || type === 'MOVE_PLUS_4') {
      this.emit({ type: 'BONUS_ACTIVATED', playerId: player.id, payload: { itemType: type, bonus: this.state.moveBonus } })
    }
    this.flush([])
    return true
  }

  private openMystery(player: PlayerState): void {
    const pool = ['COIN', 'XP', 'MOVE_PLUS_2', 'MUSIC', 'POINT'] as const
    const defs = pool.map((type) => ITEM_CATALOG[type])
    const picked = weightedPick(defs, () => this.rng.next())
    let next = player
    if (picked.type === 'COIN') next = { ...next, coins: next.coins + 3 }
    else if (picked.type === 'XP') next = { ...next, xp: next.xp + 12 }
    else if (picked.type === 'POINT') next = { ...next, points: next.points + 8 }
    else next = addInventory(next, picked.type)
    this.state = {
      ...this.state,
      players: this.state.players.map((p) => (p.id === player.id ? next : p)),
    }
    this.emit({
      type: 'ITEM_COLLECTED',
      playerId: player.id,
      payload: { itemType: picked.type, fromMystery: true, name: player.name },
    })
  }

  private async playAiTurn(): Promise<void> {
    if (this.disposed || this.state.winnerId) return
    const player = currentPlayer(this.state)
    const canPlay = player.kind === 'ai' && this.state.turnPhase === 'waiting_roll'
    if (!canPlay) return

    const { preRollMs, thinkMinMs, thinkMaxMs } = this.state.config.ai
    await this.bridge.wait(preRollMs)
    await this.rollDiceNow()
    if (this.state.turnPhase !== 'waiting_select') return

    await this.bridge.wait(thinkMinMs + Math.floor(this.rng.next() * (thinkMaxMs - thinkMinMs)))
    const strategy = getStrategy(player.difficulty)
    let moves = getLegalMoves(this.state)
    if (!moves.length) return

    const item = strategy.chooseItem(this.state, moves)
    if (item) this.useItemNow(item)
    moves = getLegalMoves(this.state)
    if (!moves.length) {
      if (this.state.lastRollWasSix) {
        this.state = { ...this.state, diceValue: null, moveBonus: 0, turnPhase: 'waiting_roll', legalTokenIds: [] }
        await this.playAiTurn()
      } else {
        await this.advanceTurn()
      }
      return
    }
    const choice = strategy.chooseMove(this.state, moves)
    await this.executeMove(choice)
  }

  private async advanceTurn(): Promise<void> {
    const previous = currentPlayer(this.state)
    this.emit({ type: 'TURN_ENDED', playerId: previous.id })
    const next = nextPlayerIndex(this.state)
    this.state = {
      ...this.state,
      currentPlayerIndex: next,
      turnPhase: 'waiting_roll',
      diceValue: null,
      consecutiveSixes: 0,
      moveBonus: 0,
      legalTokenIds: [],
      selectedTokenId: null,
      lastRollWasSix: false,
      turnNumber: this.state.turnNumber + 1,
      players: this.clearSelectable(this.state.players),
    }
    this.emit({ type: 'TURN_STARTED', playerId: currentPlayer(this.state).id })
    this.flush([])
    if (currentPlayer(this.state).kind === 'ai') {
      await this.playAiTurn()
    }
  }

  private refreshProximity(): void {
    const tokens = this.state.players.flatMap((p) => p.tokens)
    const onTrack = tokens.filter((t) => t.location.kind === 'track')
    this.state = {
      ...this.state,
      players: this.state.players.map((player) => ({
        ...player,
        tokens: player.tokens.map((token) => {
          if (token.location.kind !== 'track') return token
          if (['MOVING', 'ATTACKING', 'CAPTURING', 'CAPTURED', 'RETURNING_HOME', 'LANDING', 'ENTERING', 'WINNING'].includes(token.status)) {
            return token
          }
          const here = tokenCell(token)
          const near = onTrack.some(
            (other) => other.color !== token.color && chebyshev(here, tokenCell(other)) <= 2,
          )
          const nextStatus = near ? 'NEAR_ENEMY' : token.status === 'NEAR_ENEMY' ? 'IDLE' : token.status
          return nextStatus === token.status ? token : { ...token, status: nextStatus }
        }),
      })),
    }
  }

  private markSelectable(players: PlayerState[], moves: LegalMove[]): PlayerState[] {
    const ids = new Set(moves.map((m) => m.tokenId))
    return players.map((player) => ({
      ...player,
      tokens: player.tokens.map((token) => {
        if (!ids.has(token.id)) {
          return token.status === 'SELECTABLE' ? { ...token, status: token.location.kind === 'home' ? 'HOME_SLEEP' : 'IDLE' } : token
        }
        return { ...token, status: 'SELECTABLE' }
      }),
    }))
  }

  private clearSelectable(players: PlayerState[]): PlayerState[] {
    return players.map((player) => ({
      ...player,
      tokens: player.tokens.map((token) => {
        if (token.status !== 'SELECTABLE') return token
        if (token.location.kind === 'home') return { ...token, status: 'HOME_SLEEP' }
        if (token.location.kind === 'finished') return { ...token, status: 'WINNING' }
        return { ...token, status: 'IDLE' }
      }),
    }))
  }

  private mapToken(players: PlayerState[], tokenId: string, fn: (token: TokenState) => TokenState): PlayerState[] {
    return players.map((player) => ({
      ...player,
      tokens: player.tokens.map((token) => (token.id === tokenId ? fn(token) : token)),
    }))
  }

  private emit(event: Omit<GameEvent, 'at'>): void {
    const full: GameEvent = { ...event, at: this.state.now }
    this.flush([full])
  }

  private flush(events: GameEvent[]): void {
    for (const listener of this.listeners) listener(this.state, events)
  }
}

function addInventory(player: PlayerState, type: ItemType): PlayerState {
  const existing = player.inventory.find((s) => s.type === type)
  if (existing) {
    return {
      ...player,
      inventory: player.inventory.map((s) => (s.type === type ? { ...s, count: s.count + 1 } : s)),
    }
  }
  return { ...player, inventory: [...player.inventory, { type, count: 1 }] }
}

function removeInventory(player: PlayerState, type: ItemType): PlayerState {
  return {
    ...player,
    inventory: player.inventory
      .map((s) => (s.type === type ? { ...s, count: s.count - 1 } : s))
      .filter((s) => s.count > 0),
  }
}

export { dropCountdownSeconds }
