import type { GameState, ItemType, PlayerState, ScienceFact, ScienceQuestion } from '../engine'
import { ITEM_CATALOG, currentPlayer, dropCountdownSeconds, finishedCount, itemTitle } from '../engine'
import { ItemGlyph } from './icons'
import { PLAYER_THEME } from './theme'
import { AICharacter } from '../../../components/met/character'

export function PlayerCard({
  player,
  active,
  compact,
}: {
  player: PlayerState
  active: boolean
  compact?: boolean
}) {
  const theme = PLAYER_THEME[player.color]
  const done = finishedCount(player)
  return (
    <div
      className={`ludo-player ${active ? 'is-active' : ''} ${compact ? 'is-compact' : ''}`}
      style={{ ['--player-accent' as string]: theme.accent, ['--player-soft' as string]: theme.soft }}
    >
      <div className="ludo-player-face">
        <AICharacter
          state={active ? 'listening' : player.kind === 'ai' ? 'idle' : 'happy'}
          color={theme.token}
          eyeColor={theme.eye}
          interactive={false}
          size="100%"
          reducedMotion
          lookAt={active ? { x: 0, y: 0.2 } : { x: 0.2, y: 0.25 }}
          label={player.name}
        />
      </div>
      <div className="ludo-player-meta">
        <div className="ludo-player-name">
          {player.name}
          {player.kind === 'ai' ? <span>AI</span> : null}
        </div>
        <div className="ludo-player-pips" aria-label={`${done} finished`}>
          {player.tokens.map((token) => (
            <i
              key={token.id}
              className={
                token.location.kind === 'finished' ? 'is-done' : token.location.kind === 'track' ? 'is-out' : ''
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function InventoryDock({
  player,
  disabled,
  onUse,
}: {
  player: PlayerState
  disabled: boolean
  onUse: (type: ItemType) => void
}) {
  const usable: ItemType[] = ['MOVE_PLUS_2', 'MOVE_PLUS_4', 'MUSIC', 'MYSTERY']
  const stacks = player.inventory.filter((s) => s.count > 0)
  return (
    <div className="ludo-inventory">
      <div className="ludo-inventory-head">
        <span>Items</span>
      </div>
      <div className="ludo-inventory-stats">
        {player.coins} coins · {player.xp} xp
      </div>
      <div className="ludo-inventory-row">
        {stacks.length === 0 && <em>Empty</em>}
        {stacks.map((stack) => {
          const canUse = usable.includes(stack.type) && !disabled
          return (
            <button
              key={stack.type}
              type="button"
              className="ludo-item"
              disabled={!canUse}
              onClick={() => canUse && onUse(stack.type)}
              title={ITEM_CATALOG[stack.type].description}
            >
              <ItemGlyph type={stack.type} />
              <b>{itemTitle(stack.type)}</b>
              <i>{stack.count}</i>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TurnRibbon({ state, humanId }: { state: GameState; humanId: string | null }) {
  const player = currentPlayer(state)
  if (state.winnerId) return null
  const yours = player.id === humanId
  const label =
    state.turnPhase === 'animating'
      ? yours
        ? "You're moving…"
        : `${player.name} is moving…`
      : yours && state.turnPhase === 'waiting_roll'
        ? 'Your turn'
        : yours && state.turnPhase === 'waiting_select'
          ? 'Choose a Nuts'
          : `${player.name} is playing…`
  return (
    <div className="ludo-turn" style={{ ['--turn-accent' as string]: PLAYER_THEME[player.color].accent }}>
      {label}
    </div>
  )
}

export function DropBanner({ state }: { state: GameState }) {
  const seconds = dropCountdownSeconds(state)
  if (state.drops.phase === 'countdown') {
    return (
      <div className="ludo-drop-banner is-soon">
        <span>Bonus drop incoming</span>
        <strong>{String(seconds).padStart(2, '0')}</strong>
      </div>
    )
  }
  if (state.drops.active.length) {
    const drop = state.drops.active[0]!
    const left = Math.max(0, Math.ceil((drop.expiresAt - state.now) / 1000))
    return (
      <div className="ludo-drop-banner is-live">
        <span>Bonus drop</span>
        <strong>{itemTitle(drop.itemType)}</strong>
        <small>{left}s</small>
      </div>
    )
  }
  return (
    <div className="ludo-drop-banner">
      <span>Next drop soon</span>
    </div>
  )
}

export function EventToasts({
  items,
}: {
  items: { id: string; text: string }[]
}) {
  return (
    <div className="ludo-toasts" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className="ludo-toast">
          {item.text}
        </div>
      ))}
    </div>
  )
}

export function ScienceCard({
  fact,
  question,
  onDismiss,
  onAnswer,
}: {
  fact: ScienceFact | null
  question: ScienceQuestion | null
  onDismiss: () => void
  onAnswer: (index: number) => void
}) {
  if (!fact && !question) return null
  return (
    <div className="ludo-science" role="dialog">
      {question ? (
        <>
          <small>{question.category}</small>
          <p>{question.prompt}</p>
          <div className="ludo-science-actions">
            {question.options.map((option, index) => (
              <button key={option} type="button" onClick={() => onAnswer(index)}>
                {option}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <small>{fact!.category}</small>
          <strong>{fact!.title}</strong>
          <p>{fact!.body}</p>
          <button type="button" onClick={onDismiss}>
            Got it
          </button>
        </>
      )}
    </div>
  )
}

export function VictoryOverlay({
  state,
  onExit,
  onRematch,
}: {
  state: GameState
  onExit: () => void
  onRematch: () => void
}) {
  if (!state.winnerId) return null
  const winner = state.players.find((p) => p.id === state.winnerId)!
  const theme = PLAYER_THEME[winner.color]
  return (
    <div className="ludo-victory">
      <div className="ludo-victory-card">
        <div className="ludo-victory-face">
          <AICharacter state="happy" color={theme.token} eyeColor={theme.eye} interactive={false} size="100%" />
        </div>
        <h2>{winner.name} wins</h2>
        <p>Every Nuts made it home.</p>
        <div className="ludo-science-actions">
          <button type="button" onClick={onRematch}>
            Play again
          </button>
          <button type="button" className="is-ghost" onClick={onExit}>
            Exit
          </button>
        </div>
      </div>
    </div>
  )
}
