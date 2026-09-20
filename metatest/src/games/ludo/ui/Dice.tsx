interface DiceProps {
  value: number | null
  active: boolean
  spinning: boolean
  disabled: boolean
  reducedMotion: boolean
  spinMs: number
  onRoll: () => void
}

const FACE_ROT: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(0deg) rotateY(90deg)',
  3: 'rotateX(-90deg) rotateY(0deg)',
  4: 'rotateX(90deg) rotateY(0deg)',
  5: 'rotateX(0deg) rotateY(-90deg)',
  6: 'rotateX(0deg) rotateY(180deg)',
}

const PIP_MAP: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
}

export function Dice({ value, active, spinning, disabled, reducedMotion, spinMs, onRoll }: DiceProps) {
  const face = FACE_ROT[value ?? 1]
  return (
    <div className={`ludo-dice-wrap ${active ? 'is-active' : ''} ${spinning ? 'is-spinning' : ''}`}>
      <button
        type="button"
        className="ludo-dice-hit"
        onClick={onRoll}
        disabled={disabled || spinning}
        aria-label={active ? 'Roll dice' : 'Dice inactive'}
      >
        <div className="ludo-dice-scene">
          <div
            className={`ludo-dice ${spinning && !reducedMotion ? 'is-rolling' : ''}`}
            style={{
              transform: face,
              ['--spin-ms' as string]: `${spinMs}ms`,
              transitionDuration: reducedMotion ? '120ms' : `${spinMs}ms`,
            }}
          >
            {([1, 2, 3, 4, 5, 6] as const).map((pipFace) => (
              <div key={pipFace} className="ludo-dice-face" data-face={pipFace}>
                <div className="ludo-dice-pips">
                  {Array.from({ length: 9 }, (_, i) => (
                    <span key={i} className={PIP_MAP[pipFace]!.includes(i + 1) ? 'is-on' : ''} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <span className="ludo-dice-label">{active ? 'Roll Dice' : spinning ? 'Rolling' : 'Wait'}</span>
      </button>
    </div>
  )
}
