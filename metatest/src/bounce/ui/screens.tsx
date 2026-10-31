import { useEffect, useState } from 'react'
import { Met } from '../../components/met'
import { formatTime } from '../math'
import { levelSummaries } from '../levels'
import { keyLabel, type Action } from '../input'
import type { RunResult } from '../session'
import { GameButton, useBounce } from './kit'
import { tryLockLandscape } from './orient'

const ROUTES: Record<string, string> = {
  safe: 'Safe road',
  advanced: 'High road',
  secret: 'Secret path',
  speed: 'Fast drop',
  upper: 'Upper gallery',
  tower: 'Tower',
}

export function MenuScreen() {
  const { session, save } = useBounce()
  return (
    <div className="b-screen">
      <div className="b-menu">
        <Met className="b-met" state="idle" color="violet" glow label="Met" />
        <div>
          <h1 className="b-title">BOUNCE</h1>
          <p className="b-tag">Keep rolling.</p>
        </div>
        <div className="b-actions">
          <GameButton
            onClick={() => {
              tryLockLandscape()
              session.startLevel(save.continueId())
            }}
          >
            Play
          </GameButton>
          <GameButton kind="soft" onClick={() => session.showLevels()}>
            Levels
          </GameButton>
          <GameButton kind="ghost" onClick={() => session.openSettings()}>
            Settings
          </GameButton>
        </div>
        <p className="b-keys">Arrows or A D to roll. Space to bounce.</p>
      </div>
    </div>
  )
}

export function LevelSelectScreen() {
  const { session, save, audio } = useBounce()
  const levels = levelSummaries()
  return (
    <div className="b-screen">
      <button type="button" className="b-back" onClick={() => { audio.ui(); session.showMenu() }}>
        Back
      </button>
      <div className="b-levels">
        {levels.map((level) => {
          const open = save.isUnlocked(level.id)
          const record = save.record(level.id)
          return (
            <button
              key={level.id}
              type="button"
              className="b-level"
              disabled={!open}
              onClick={() => {
                audio.ui()
                tryLockLandscape()
                session.startLevel(level.id)
              }}
            >
              <span className="b-level-num">{String(level.number).padStart(2, '0')}</span>
              <strong>{level.name}</strong>
              <small>{open ? (record.completed && record.bestMs !== null ? formatTime(record.bestMs) : 'Ready') : 'Locked'}</small>
              <small>
                {record.coins.length}/{level.coins} found
              </small>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function SettingsScreen() {
  const { session, save, audio, input } = useBounce()
  const [settings, setSettings] = useState(save.settings)
  const [arm, setArm] = useState<Action | null>(null)
  const [rev, setRev] = useState(0)

  useEffect(() => {
    if (!arm) return
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.code !== 'Escape') input.setBinding(arm, event.code)
      setArm(null)
      setRev((value) => value + 1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [arm, input])

  const patch = (partial: Partial<typeof settings>) => {
    const next = { ...settings, ...partial }
    setSettings(next)
    save.updateSettings(partial)
    audio.applySettings(save.settings)
  }

  return (
    <div className="b-scrim">
      <div className="b-card">
        <h2 className="b-title" style={{ fontSize: 28 }}>Settings</h2>
        <label className="b-field">
          Master
          <input type="range" min={0} max={1} step={0.01} value={settings.master} onChange={(event) => patch({ master: Number(event.target.value) })} />
        </label>
        <label className="b-field">
          Music
          <input type="range" min={0} max={1} step={0.01} value={settings.music} onChange={(event) => patch({ music: Number(event.target.value) })} />
        </label>
        <label className="b-field">
          Effects
          <input type="range" min={0} max={1} step={0.01} value={settings.sfx} onChange={(event) => patch({ sfx: Number(event.target.value) })} />
        </label>
        <button type="button" className="b-check" onClick={() => patch({ muted: !settings.muted })}>
          {settings.muted ? 'Muted' : 'Sound on'}
        </button>
        <div className="b-field" data-rev={rev}>
          Controls
          <div className="b-bind">
            {(['left', 'right', 'jump'] as const).map((action) => (
              <button key={action} type="button" className={arm === action ? 'is-arm' : ''} onClick={() => setArm(action)}>
                {action} {keyLabel(input.bindings[action][0] ?? '')}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="b-check"
            onClick={() => {
              input.resetBindings()
              setRev((value) => value + 1)
            }}
          >
            Reset keys
          </button>
        </div>
        <div className="b-row">
          <GameButton onClick={() => session.closeSettings()}>Done</GameButton>
        </div>
      </div>
    </div>
  )
}

export function BootScreen({ label }: { label: string }) {
  return (
    <div className="b-boot">
      <div className="b-boot-inner">
        <Met className="b-met" state="curious" color="violet" glow label="Met" />
        <h1 className="b-title">BOUNCE</h1>
        <p className="b-tag">{label}</p>
        <div className="b-bar" aria-hidden="true"><span /></div>
      </div>
    </div>
  )
}

export function Hud() {
  const { session } = useBounce()
  const hud = session.hud
  return (
    <div className="b-hud">
      <div className="b-hud-name">{hud.number > 0 ? `${hud.number}  ${hud.name}` : 'Bounce'}</div>
      <div className="b-hud-meta">
        {hud.coins}/{hud.total} · {formatTime(hud.time * 1000)}
      </div>
      <button type="button" className="b-pause" onClick={() => session.pause()} aria-label="Pause">
        II
      </button>
    </div>
  )
}

export function PauseScreen() {
  const { session } = useBounce()
  return (
    <div className="b-scrim">
      <div className="b-card">
        <h2 className="b-title" style={{ fontSize: 32 }}>Paused</h2>
        <div className="b-actions" style={{ marginTop: 16 }}>
          <GameButton onClick={() => session.resume()}>Resume</GameButton>
          <GameButton kind="soft" onClick={() => session.restart()}>Restart</GameButton>
          <GameButton kind="ghost" onClick={() => session.openSettings()}>Settings</GameButton>
          <GameButton kind="ghost" onClick={() => session.exit()}>Exit</GameButton>
        </div>
      </div>
    </div>
  )
}

export function CompleteScreen({ result }: { result: RunResult }) {
  const { session } = useBounce()
  return (
    <div className="b-scrim">
      <div className="b-card">
        <p className="b-tag">Level {result.number}</p>
        <h2 className="b-title" style={{ fontSize: 32 }}>{result.name}</h2>
        <div className="b-stat"><span>Time</span><strong>{formatTime(result.time * 1000)}</strong></div>
        <div className="b-stat">
          <span>Best</span>
          <strong className={result.isBest ? 'b-best' : ''}>{formatTime(result.bestMs)}{result.isBest ? '  new' : ''}</strong>
        </div>
        <div className="b-stat"><span>Collected</span><strong>{result.coins}/{result.total}</strong></div>
        {result.secrets > 0 ? <div className="b-stat"><span>Secrets</span><strong>{result.secrets}</strong></div> : null}
        {result.routes.length > 0 ? (
          <ul className="b-routes">
            {result.routes.map((route) => (
              <li key={route}>{ROUTES[route] ?? route}</li>
            ))}
          </ul>
        ) : null}
        <div className="b-row">
          {result.nextId ? (
            <GameButton onClick={() => { tryLockLandscape(); session.startLevel(result.nextId ?? '') }}>Next</GameButton>
          ) : (
            <GameButton onClick={() => session.showLevels()}>Levels</GameButton>
          )}
          <GameButton kind="soft" onClick={() => session.restart()}>Replay</GameButton>
          <GameButton kind="ghost" onClick={() => session.exit()}>Menu</GameButton>
        </div>
      </div>
    </div>
  )
}

export function TouchControls() {
  return (
    <div className="b-touch">
      <Pad action="left" className="b-pad b-pad-left" label="<" />
      <Pad action="right" className="b-pad b-pad-right" label=">" />
      <Pad action="jump" className="b-pad b-pad-jump" label="●" />
    </div>
  )
}

function Pad({ action, className, label }: { action: Action; className: string; label: string }) {
  const { input } = useBounce()
  const [down, setDown] = useState(false)
  const end = (id: number) => {
    input.pointerUp(id)
    setDown(false)
  }
  return (
    <button
      type="button"
      className={down ? `${className} is-down` : className}
      aria-label={action}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        input.pointerDown(action, event.pointerId)
        setDown(true)
      }}
      onPointerUp={(event) => end(event.pointerId)}
      onPointerCancel={(event) => end(event.pointerId)}
      onLostPointerCapture={(event) => end(event.pointerId)}
    >
      {label}
    </button>
  )
}

export function RotateScreen() {
  return (
    <div className="b-rotate">
      <div className="b-boot-inner">
        <div className="b-phone" />
        <Met className="b-met" state="curious" color="violet" label="Met" />
        <h2 className="b-title" style={{ fontSize: 36 }}>Rotate</h2>
        <p className="b-tag">Turn your phone sideways to roll.</p>
      </div>
    </div>
  )
}
