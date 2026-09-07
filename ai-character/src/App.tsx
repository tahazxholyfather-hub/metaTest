import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AICharacter, AI_CHARACTER_STATES, type AICharacterHandle, type AICharacterState, type Vec2 } from './character'

const THEMES = [
  { name: 'Cream', color: '#F5F1EA', eye: '#0E0E10' },
  { name: 'Sun', color: '#FFD84D', eye: '#141414' },
  { name: 'Mint', color: '#BFEAD6', eye: '#0F1A16' },
  { name: 'Coral', color: '#FF8A73', eye: '#1B0F0D' },
  { name: 'Sky', color: '#9CC8FF', eye: '#0C1424' },
  { name: 'Ink', color: '#2B2B30', eye: '#F5F1EA' },
] as const

const DESCRIPTIONS: Record<AICharacterState, string> = {
  idle: 'Resting. Gaze wanders, occasional blinks, slow breathing.',
  curious: 'One eye slightly larger, head-tilt roll, quick darting looks.',
  happy: 'Bottom lids arch upward into crescents, eyes lift and beam.',
  sad: 'Eyes lean inward, outer corners droop, gaze sinks and sighs.',
  surprised: 'A recoil squash, then eyes pop wide with overshoot.',
  confused: 'Asymmetric squint, alternating head tilt, gaze darts between two points.',
  sleepy: 'Heavy rounded lids that slowly sink, then jolt back open.',
  thinking: 'Squinted upper lids, gaze up and to the side, switching sides.',
  listening: 'Wide, still, attentive. Tilts toward the pointer and nods.',
  speaking: 'Syllable-rhythm pulses, emphasis widening, glances away for words.',
  excited: 'Big eyes with bouncing squash-and-stretch and quick saccades.',
  annoyed: 'Flat half-closed lids slanted inward, looks away, rolls eyes.',
  shocked: 'Very wide, spread apart, frozen with a fine tremor.',
}

function LookPad({ value, onChange }: { value: Vec2 | null; onChange: (v: Vec2 | null) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const set = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const rect = ref.current!.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1
      onChange({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) })
    },
    [onChange],
  )

  return (
    <div
      ref={ref}
      className={`lookpad${value ? ' is-active' : ''}`}
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        set(e)
      }}
      onPointerMove={(e) => dragging.current && set(e)}
      onPointerUp={() => {
        dragging.current = false
        onChange(null)
      }}
      onPointerCancel={() => {
        dragging.current = false
        onChange(null)
      }}
      aria-label="Drag to aim the gaze"
      role="slider"
      aria-valuetext={value ? `${value.x.toFixed(2)}, ${value.y.toFixed(2)}` : 'released'}
    >
      <span className="lookpad__hint">{value ? 'aiming' : 'drag to aim gaze'}</span>
      {value && (
        <span className="lookpad__dot" style={{ left: `${(value.x + 1) * 50}%`, top: `${(value.y + 1) * 50}%` }} />
      )}
    </div>
  )
}

export default function App() {
  const [state, setState] = useState<AICharacterState>('idle')
  const [interactive, setInteractive] = useState(true)
  const [intensity, setIntensity] = useState(1)
  const [theme, setTheme] = useState(0)
  const [lookAt, setLookAt] = useState<Vec2 | null>(null)
  const [simulateAudio, setSimulateAudio] = useState(false)
  const [audioLevel, setAudioLevel] = useState<number | null>(null)
  const [blinks, setBlinks] = useState(0)
  const handle = useRef<AICharacterHandle>(null)

  useEffect(() => {
    if (!simulateAudio || state !== 'speaking') {
      setAudioLevel(null)
      return
    }
    let raf = 0
    const start = performance.now()
    const loop = (now: number) => {
      const t = (now - start) / 1000
      const envelope = Math.max(0, Math.sin(t * 0.9)) > 0.15 ? 1 : 0
      const level = envelope * Math.max(0, 0.55 + 0.45 * Math.sin(t * 31) * Math.sin(t * 7.3))
      setAudioLevel(level)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [simulateAudio, state])

  const current = THEMES[theme]
  const snippet = [
    `<AICharacter`,
    `  state="${state}"`,
    interactive ? `  interactive` : null,
    intensity !== 1 ? `  intensity={${intensity.toFixed(2)}}` : null,
    theme !== 0 ? `  color="${current.color}"\n  eyeColor="${current.eye}"` : null,
    `/>`,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div className="app">
      <header className="app__header">
        <div className="brand">
          <AICharacter state="happy" size={28} color={current.color} eyeColor={current.eye} />
          <span>AI Character</span>
        </div>
        <p className="tagline">One flat circle. Two eyes. All the personality.</p>
      </header>

      <main className="layout">
        <section className="stage" style={{ ['--body' as string]: current.color }}>
          <div className="stage__character">
            <AICharacter
              ref={handle}
              state={state}
              interactive={interactive}
              intensity={intensity}
              lookAt={lookAt}
              audioLevel={audioLevel}
              color={current.color}
              eyeColor={current.eye}
              onBlink={() => setBlinks((n) => n + 1)}
            />
          </div>
          <div className="stage__caption">
            <h1 className="stage__state">{state}</h1>
            <p className="stage__desc">{DESCRIPTIONS[state]}</p>
            <p className="stage__meta">
              {interactive ? 'Move your pointer around — tap the body to poke it.' : 'Pointer tracking is off.'}{' '}
              <span className="muted">Blinks: {blinks}</span>
            </p>
          </div>
        </section>

        <aside className="panel">
          <div className="panel__section">
            <h2>State</h2>
            <div className="chips">
              {AI_CHARACTER_STATES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip${s === state ? ' is-active' : ''}`}
                  onClick={() => setState(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="panel__section panel__row">
            <label className="toggle">
              <input type="checkbox" checked={interactive} onChange={(e) => setInteractive(e.target.checked)} />
              <span>Interactive</span>
            </label>
            <div className="buttons">
              <button type="button" className="btn" onClick={() => handle.current?.blink()}>
                Blink
              </button>
              <button type="button" className="btn" onClick={() => handle.current?.poke()}>
                Poke
              </button>
            </div>
          </div>

          <div className="panel__section">
            <label className="range">
              <span>
                Intensity <em>{Math.round(intensity * 100)}%</em>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="panel__section">
            <h2>Gaze</h2>
            <LookPad value={lookAt} onChange={setLookAt} />
          </div>

          <div className="panel__section">
            <h2>Theme</h2>
            <div className="swatches">
              {THEMES.map((t, i) => (
                <button
                  key={t.name}
                  type="button"
                  className={`swatch${i === theme ? ' is-active' : ''}`}
                  style={{ background: t.color }}
                  onClick={() => setTheme(i)}
                  aria-label={t.name}
                  title={t.name}
                >
                  <span style={{ background: t.eye }} />
                </button>
              ))}
            </div>
          </div>

          {state === 'speaking' && (
            <div className="panel__section">
              <label className="toggle">
                <input type="checkbox" checked={simulateAudio} onChange={(e) => setSimulateAudio(e.target.checked)} />
                <span>Drive with simulated audio level</span>
              </label>
            </div>
          )}

          <div className="panel__section">
            <h2>Usage</h2>
            <pre className="code">{snippet}</pre>
          </div>
        </aside>
      </main>

      <section className="gallery">
        <h2>All states</h2>
        <div className="gallery__grid">
          {AI_CHARACTER_STATES.map((s) => (
            <button
              key={s}
              type="button"
              className={`tile${s === state ? ' is-active' : ''}`}
              onClick={() => setState(s)}
            >
              <AICharacter state={s} interactive={interactive} color={current.color} eyeColor={current.eye} />
              <span>{s}</span>
            </button>
          ))}
        </div>
      </section>

      <footer className="footer">
        The body never moves. Depth comes only from how the eyes sit on an imaginary sphere: they slide along great
        circles, foreshorten toward the rim, and tilt with the meridians.
      </footer>
    </div>
  )
}
