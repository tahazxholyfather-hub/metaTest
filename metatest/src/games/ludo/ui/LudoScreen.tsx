import { useEffect, useMemo, useRef, useState } from 'react'
import {
  GameRuntime,
  itemTitle,
  mergeConfig,
  REDUCED_MOTION_CONFIG,
  type GameEvent,
  type GameState,
  type ItemType,
  type MatchSetup,
} from '../engine'
import { AudioSystem } from '../audio/AudioSystem'
import { Board } from './Board'
import { Dice } from './Dice'
import {
  DropBanner,
  EventToasts,
  InventoryDock,
  PlayerCard,
  ScienceCard,
  TurnRibbon,
  VictoryOverlay,
} from './chrome'

interface LudoScreenProps {
  setup: MatchSetup
  onExit: () => void
}

export function LudoScreen({ setup, onExit }: LudoScreenProps) {
  const reduced = usePrefersReducedMotion()
  const audio = useMemo(() => new AudioSystem(), [])
  const runtimeRef = useRef<GameRuntime | null>(null)
  const [state, setState] = useState<GameState | null>(null)
  const [hoppingId, setHoppingId] = useState<string | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([])
  const [soundOn, setSoundOn] = useState(true)
  const [musicOn, setMusicOn] = useState(true)
  const setupKey = useMemo(() => JSON.stringify(setup), [setup])
  const toastsRef = useRef(setToasts)

  const pushToast = (text: string) => {
    const id = `${Date.now()}-${text}`
    toastsRef.current((prev) => [...prev.slice(-3), { id, text }])
    window.setTimeout(() => toastsRef.current((prev) => prev.filter((t) => t.id !== id)), 2400)
  }

  useEffect(() => {
    audio.setReducedMotion(reduced)
  }, [audio, reduced])

  useEffect(() => {
    const config = mergeConfig({
      ...setup.config,
      ...(reduced ? REDUCED_MOTION_CONFIG : {}),
    })
    const runtime = new GameRuntime({ ...setup, config }, performance.now())
    runtimeRef.current = runtime
    runtime.setBridge({
      wait: (ms) => sleep(reduced ? Math.min(ms, 90) : ms),
      waitStep: async (tokenId) => {
        setHoppingId(tokenId)
        audio.play('move')
        await sleep(runtime.getState().config.animation.stepMs)
        setHoppingId(null)
      },
    })
    const unsub = runtime.subscribe((next, events) => {
      setState(next)
      for (const event of events) reactToEvent(event, audio, pushToast)
    })
    const timer = window.setInterval(() => runtime.tick(performance.now()), 250)
    void runtime.startAiLoop()
    return () => {
      unsub()
      runtime.dispose()
      window.clearInterval(timer)
    }
    // setup is represented by setupKey so rematch can rebuild.
  }, [setupKey, reduced, audio, setup])

  useEffect(() => {
    if (!state?.activeFact || state.activeQuestion) return
    const timer = window.setTimeout(() => runtimeRef.current?.dismissOverlay(), 4800)
    return () => window.clearTimeout(timer)
  }, [state?.activeFact, state?.activeQuestion])

  if (!state) return <div className="ludo-loading">Opening the board…</div>

  const human = state.players.find((p) => p.kind === 'human') ?? state.players[0]!
  const current = state.players[state.currentPlayerIndex]!
  const inventoryPlayer = state.mode === 'local' ? current : human
  const canRoll = current.kind === 'human' && state.turnPhase === 'waiting_roll' && !state.winnerId && !spinning
  const canAct = current.kind === 'human' && !state.winnerId && state.turnPhase !== 'animating'

  const onRoll = async () => {
    const runtime = runtimeRef.current
    if (!runtime || !canRoll) return
    setSpinning(true)
    audio.play('dice-roll')
    const spin = state.config.animation.diceSpinMs
    await sleep(reduced ? 80 : spin * 0.72)
    await runtime.rollDice()
    await sleep(reduced ? 40 : spin * 0.2)
    setSpinning(false)
    audio.play('dice-result')
  }

  const onSelect = (id: string) => {
    if (current.kind !== 'human' || state.turnPhase !== 'waiting_select') return
    void runtimeRef.current?.selectToken(id)
  }

  const onUse = (type: ItemType) => {
    void runtimeRef.current?.useItem(type).then((used) => {
      if (used && type === 'MUSIC') audio.playMusic()
      if (used && (type === 'MOVE_PLUS_2' || type === 'MOVE_PLUS_4')) audio.play('bonus')
    })
  }

  return (
    <div className="ludo-table">
      <header className="ludo-top">
        <div className="ludo-brand">
          <strong>Metch Ludo</strong>
          <TurnRibbon state={state} humanId={human.id} />
        </div>
        <div className="ludo-top-actions">
          <button
            type="button"
            className={soundOn ? 'is-on' : ''}
            onClick={() => setSoundOn(audio.toggleSound())}
            aria-label="Sound"
          >
            Sound
          </button>
          <button
            type="button"
            className={musicOn ? 'is-on' : ''}
            onClick={() => setMusicOn(audio.toggleMusic())}
            aria-label="Music"
          >
            Music
          </button>
          <button type="button" onClick={onExit} aria-label="Exit">
            Exit
          </button>
        </div>
      </header>

      {state.players.map((player) => (
        <div key={player.id} className={`ludo-seat is-${player.color}`}>
          <PlayerCard player={player} active={player.id === current.id} />
        </div>
      ))}

      <Board state={state} hoppingId={hoppingId} reducedMotion={reduced} onSelectToken={onSelect} />

      <div className="ludo-bottom">
        <InventoryDock player={inventoryPlayer} disabled={!canAct} onUse={onUse} />
        <Dice
          value={state.diceValue}
          active={canRoll}
          spinning={spinning}
          disabled={!canRoll}
          reducedMotion={reduced}
          spinMs={state.config.animation.diceSpinMs}
          onRoll={() => void onRoll()}
        />
        <DropBanner state={state} />
      </div>

      <EventToasts items={toasts} />
      <ScienceCard
        fact={state.activeFact}
        question={state.activeQuestion}
        onDismiss={() => runtimeRef.current?.dismissOverlay()}
        onAnswer={(index) => runtimeRef.current?.answerQuestion(index)}
      />
      <VictoryOverlay state={state} onExit={onExit} onRematch={onExit} />
    </div>
  )
}

function reactToEvent(
  event: GameEvent,
  audio: AudioSystem,
  toast: (text: string) => void,
): void {
  switch (event.type) {
    case 'ITEM_COLLECTED': {
      const name = String(event.payload?.name ?? 'Player')
      const type = event.payload?.itemType as ItemType | undefined
      if (type) toast(`${name} found ${itemTitle(type)}`)
      audio.play('collect')
      break
    }
    case 'ITEM_SPAWNED':
      audio.play('spawn')
      toast('Bonus drop!')
      break
    case 'TOKEN_CAPTURED':
      audio.play('capture')
      break
    case 'TOKEN_RETURNING_HOME':
      audio.play('return-home')
      break
    case 'TOKEN_LANDED':
      audio.play('land')
      break
    case 'PLAYER_WON':
      audio.play('victory')
      break
    case 'MUSIC_STARTED':
      audio.playMusic()
      break
    case 'BONUS_ACTIVATED':
      audio.play('bonus')
      break
    default:
      break
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return reduced
}
