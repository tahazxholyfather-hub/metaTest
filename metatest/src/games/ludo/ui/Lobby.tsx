import { useEffect, useMemo, useState } from 'react'
import type { AiDifficulty, GameMode, MatchSetup, PlayerColor } from '../engine'
import { PLAYER_COLORS } from '../engine'
import { AICharacter } from '../../../components/met/character'
import { PLAYER_THEME } from './theme'

interface LobbyProps {
  defaultName: string
  onStart: (setup: MatchSetup) => void
}

export function Lobby({ defaultName, onStart }: LobbyProps) {
  const [mode, setMode] = useState<GameMode>('single')
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal')
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4)
  const [color, setColor] = useState<PlayerColor>('blue')
  const [name, setName] = useState(defaultName)

  useEffect(() => {
    setName(defaultName)
  }, [defaultName])

  const preview = useMemo(() => PLAYER_COLORS, [])

  return (
    <div className="ludo-lobby">
      <header className="ludo-lobby-brand">
        <span className="ludo-mark" aria-hidden>
          <AICharacter state="idle" color={PLAYER_THEME[color].token} eyeColor={PLAYER_THEME[color].eye} interactive={false} size="100%" lookAt={{ x: 0.1, y: 0.15 }} />
        </span>
        <div>
          <p>Metch</p>
          <h1>Ludo</h1>
        </div>
      </header>

      <div className="ludo-mode-switch" role="tablist">
        <button type="button" className={mode === 'single' ? 'is-on' : ''} onClick={() => setMode('single')}>
          vs AI
        </button>
        <button type="button" className={mode === 'local' ? 'is-on' : ''} onClick={() => setMode('local')}>
          Local
        </button>
      </div>

      <label className="ludo-field">
        <span>Your name</span>
        <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
      </label>

      <div className="ludo-field">
        <span>Color</span>
        <div className="ludo-color-row">
          {preview.map((c) => (
            <button
              key={c}
              type="button"
              className={color === c ? 'is-on' : ''}
              onClick={() => setColor(c)}
              aria-label={PLAYER_THEME[c].label}
            >
              <AICharacter state={color === c ? 'happy' : 'idle'} color={PLAYER_THEME[c].token} eyeColor={PLAYER_THEME[c].eye} interactive={false} size="100%" reducedMotion />
            </button>
          ))}
        </div>
      </div>

      {mode === 'single' ? (
        <div className="ludo-field">
          <span>AI</span>
          <div className="ludo-pills">
            {(['easy', 'normal', 'hard'] as const).map((d) => (
              <button key={d} type="button" className={difficulty === d ? 'is-on' : ''} onClick={() => setDifficulty(d)}>
                {d}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="ludo-field">
          <span>Players</span>
          <div className="ludo-pills">
            {([2, 3, 4] as const).map((n) => (
              <button key={n} type="button" className={playerCount === n ? 'is-on' : ''} onClick={() => setPlayerCount(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className="ludo-start"
        onClick={() =>
          onStart({
            mode,
            humanColor: color,
            playerCount: mode === 'single' ? 4 : playerCount,
            difficulty,
            names: { [color]: name.trim() || 'You' },
          })
        }
      >
        Start match
      </button>
      <p className="ludo-hint">Board first. Nuts second. Everything else stays quiet.</p>
    </div>
  )
}
