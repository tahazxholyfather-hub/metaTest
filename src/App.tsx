import { useCallback, useEffect, useRef, useState } from 'react';
import { AICell, CELL_MOODS, CELL_STATES } from './cell';
import type { AICellHandle, CellMood, CellState } from './cell';

const SIZES = [
  { label: 'S · 120px', value: 120 },
  { label: 'M · 220px', value: 220 },
  { label: 'L · 340px', value: 340 },
];

export default function App() {
  const cell = useRef<AICellHandle>(null);
  const [activeState, setActiveState] = useState<CellState>('idle');
  const [expression, setExpression] = useState<CellState | ''>('');
  const [mood, setMood] = useState<CellMood>('neutral');
  const [energy, setEnergy] = useState(0.5);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSim, setVoiceSim] = useState(false);
  const [manualIntensity, setManualIntensity] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [size, setSize] = useState(340);
  const [tour, setTour] = useState(false);

  const applyState = useCallback((s: CellState) => {
    setActiveState(s);
    cell.current?.setState(s);
  }, []);

  // Auto-tour through every state.
  useEffect(() => {
    if (!tour) return;
    let i = CELL_STATES.indexOf(activeState);
    const timer = setInterval(() => {
      i = (i + 1) % CELL_STATES.length;
      applyState(CELL_STATES[i]);
    }, 2600);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, applyState]);

  // Simulated streaming voice amplitude (like AI TTS output).
  useEffect(() => {
    if (!voiceSim) return;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = performance.now() / 1000;
      const syll = Math.max(0, Math.sin(t * 11) * 0.5 + Math.sin(t * 7.3) * 0.4 + Math.sin(t * 2.1) * 0.3);
      const gate = Math.sin(t * 0.55) > -0.4 ? 1 : 0;
      cell.current?.setSpeechIntensity(Math.min(1, syll * gate));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [voiceSim]);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>AI Cell Character</h1>
          <p>Living, stateful assistant avatar · React + TypeScript + SVG</p>
        </div>
        <div className="header-actions">
          <button className={`chip${tour ? ' on' : ''}`} onClick={() => setTour((v) => !v)}>
            {tour ? '■ Stop tour' : '▶ Tour all states'}
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="stage">
          <AICell
            ref={cell}
            size={size}
            initialState="idle"
            reducedMotion={reducedMotion || undefined}
          />
          <div className="stage-caption">
            <span className="state-name">{activeState}</span>
            {speaking && <span className="badge">speaking</span>}
            {listening && <span className="badge">listening</span>}
            {voiceSim && <span className="badge">voice stream</span>}
          </div>
          <div className="size-row">
            {SIZES.map((s) => (
              <button key={s.value} className={`chip small${size === s.value ? ' on' : ''}`} onClick={() => setSize(s.value)}>
                {s.label}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>State</h2>
          <div className="state-grid">
            {CELL_STATES.map((s) => (
              <button
                key={s}
                className={`state-btn${activeState === s ? ' on' : ''}`}
                onClick={() => {
                  setTour(false);
                  applyState(s);
                }}
              >
                {s}
              </button>
            ))}
          </div>

          <h2>AI interaction</h2>
          <div className="row">
            <button
              className={`chip${speaking ? ' on' : ''}`}
              onClick={() => {
                const next = !speaking;
                setSpeaking(next);
                cell.current?.setSpeaking(next);
                if (next) setActiveState('speaking');
                else setActiveState(cell.current?.getState() ?? 'idle');
              }}
            >
              setSpeaking({String(!speaking)})
            </button>
            <button
              className={`chip${listening ? ' on' : ''}`}
              onClick={() => {
                const next = !listening;
                setListening(next);
                cell.current?.setListening(next);
                if (next) setActiveState('listening');
                else setActiveState(cell.current?.getState() ?? 'idle');
              }}
            >
              setListening({String(!listening)})
            </button>
            <button className={`chip${voiceSim ? ' on' : ''}`} onClick={() => setVoiceSim((v) => !v)}>
              {voiceSim ? 'stop voice stream' : 'stream voice amplitude'}
            </button>
          </div>

          <label className="slider-row">
            <span>speech intensity (manual)</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={manualIntensity}
              onChange={(e) => {
                const v = Number(e.target.value);
                setManualIntensity(v);
                cell.current?.setSpeechIntensity(v);
              }}
            />
            <code>{manualIntensity.toFixed(2)}</code>
          </label>

          <h2>Expression overlay</h2>
          <div className="row">
            <select
              value={expression}
              onChange={(e) => {
                const v = e.target.value as CellState | '';
                setExpression(v);
                cell.current?.setExpression(v === '' ? null : v);
              }}
            >
              <option value="">— none —</option>
              {CELL_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <h2>Mood & energy</h2>
          <div className="row">
            {CELL_MOODS.map((m) => (
              <button
                key={m}
                className={`chip small${mood === m ? ' on' : ''}`}
                onClick={() => {
                  setMood(m);
                  cell.current?.setMood(m);
                }}
              >
                {m}
              </button>
            ))}
          </div>
          <label className="slider-row">
            <span>energy</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={energy}
              onChange={(e) => {
                const v = Number(e.target.value);
                setEnergy(v);
                cell.current?.setEnergy(v);
              }}
            />
            <code>{energy.toFixed(2)}</code>
          </label>

          <h2>Accessibility</h2>
          <div className="row">
            <button className={`chip${reducedMotion ? ' on' : ''}`} onClick={() => setReducedMotion((v) => !v)}>
              reduced motion {reducedMotion ? 'on' : 'off'}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
