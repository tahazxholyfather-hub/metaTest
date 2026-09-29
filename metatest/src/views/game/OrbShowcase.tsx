import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ELEMENT_ORB_DEFINITIONS,
  ELEMENT_SYMBOLS,
  ORB_ANIMATION_NAMES,
  ORB_SIZES,
  ORB_STATES,
  POWER_ORB_DEFINITIONS,
  POWER_ORB_TYPES,
  Orb,
  type ElementSymbol,
  type OrbAnimationName,
  type OrbCharge,
  type OrbHandle,
  type OrbSize,
  type OrbState,
  type PowerOrbType,
} from '../../components/game/orb';

const STATE_LABEL: Record<OrbState, string> = {
  normal: 'Normal',
  selected: 'Selected',
  aiming: 'Aiming',
  charged: 'Charged',
  ionized: 'Ionized',
  bonded: 'Bonded',
  unstable: 'Unstable',
  frozen: 'Frozen',
  reacting: 'Reacting',
  destroying: 'Destroying',
  disabled: 'Disabled',
};

const CHARGE_SAMPLES: { element: ElementSymbol; charge?: OrbCharge }[] = [
  { element: 'Na' },
  { element: 'K' },
  { element: 'Ca' },
  { element: 'Mg' },
  { element: 'Fe' },
  { element: 'Fe', charge: '3+' },
  { element: 'Al' },
  { element: 'Cl' },
  { element: 'F' },
  { element: 'Br' },
  { element: 'I' },
  { element: 'O' },
  { element: 'S' },
];

type Focus =
  | { kind: 'element'; element: ElementSymbol }
  | { kind: 'power'; type: PowerOrbType };

const FIELD = Array.from({ length: 48 }, (_, index) => ELEMENT_SYMBOLS[index % ELEMENT_SYMBOLS.length]);

export default function OrbShowcase() {
  const labRef = useRef<HTMLElement>(null);
  const orbRef = useRef<OrbHandle>(null);
  const [focus, setFocus] = useState<Focus>({ kind: 'element', element: 'O' });
  const [labState, setLabState] = useState<OrbState>('normal');
  const [labSize, setLabSize] = useState<OrbSize>('xl');
  const [completed, setCompleted] = useState<OrbAnimationName | null>(null);
  const [session, setSession] = useState(0);
  const [dense, setDense] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    const html = document.documentElement;
    const body = document.body;
    const previousHtml = html.style.background;
    const previousBody = body.style.background;
    document.title = 'Chimball Orbs';
    html.style.background = '#070b14';
    body.style.background = '#070b14';
    return () => {
      document.title = previousTitle;
      html.style.background = previousHtml;
      body.style.background = previousBody;
    };
  }, []);

  const focusKey = focus.kind === 'element' ? focus.element : focus.type;
  const field = dense
    ? Array.from({ length: 140 }, (_, index) => ELEMENT_SYMBOLS[index % ELEMENT_SYMBOLS.length])
    : FIELD;

  const focusOn = (next: Focus) => {
    setFocus(next);
    setLabState('normal');
    setCompleted(null);
    setSession((value) => value + 1);
    labRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <main className="orb-showcase" dir="ltr">
      <style>{SHOWCASE_CSS}</style>
      <header className="orb-showcase__header">
        <p>Chimball</p>
        <h1>Orb system</h1>
      </header>

      <section>
        <h2>Elements</h2>
        <div className="orb-showcase__grid">
          {ELEMENT_SYMBOLS.map((symbol) => (
            <figure key={symbol}>
              <button type="button" className="orb-showcase__pick" onClick={() => focusOn({ kind: 'element', element: symbol })}>
                <Orb element={symbol} size="md" />
              </button>
              <figcaption>
                <b>{symbol}</b>
                <span>{ELEMENT_ORB_DEFINITIONS[symbol].name}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section>
        <h2>Power orbs</h2>
        <div className="orb-showcase__grid">
          {POWER_ORB_TYPES.map((type) => (
            <figure key={type}>
              <button type="button" className="orb-showcase__pick" onClick={() => focusOn({ kind: 'power', type })}>
                <Orb type={type} size="md" />
              </button>
              <figcaption>
                <b>{POWER_ORB_DEFINITIONS[type].name}</b>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section>
        <h2>States</h2>
        <div className="orb-showcase__grid orb-showcase__grid--states">
          <StateCell label="Normal"><Orb element="H" size="md" state="normal" /></StateCell>
          <StateCell label="Selected"><Orb element="O" size="md" state="selected" /></StateCell>
          <StateCell label="Aiming"><Orb element="N" size="md" state="aiming" aimAngle={90} /></StateCell>
          <StateCell label="Charged"><Orb element="Na" size="md" state="charged" /></StateCell>
          <StateCell label="Ionized"><Orb element="Cl" size="md" state="ionized" /></StateCell>
          <StateCell label="Unstable"><Orb element="S" size="md" state="unstable" /></StateCell>
          <StateCell label="Frozen"><Orb element="O" size="md" state="frozen" /></StateCell>
          <StateCell label="Reacting"><Orb element="Mg" size="md" state="reacting" /></StateCell>
          <StateCell label="Destroying">
            <Orb element="Fe" size="md" state="destroying" animated={false} />
          </StateCell>
          <StateCell label="Disabled"><Orb element="C" size="md" state="disabled" /></StateCell>
          <figure className="orb-showcase__pair-cell">
            <div className="orb-showcase__pair">
              <Orb element="H" size="md" state="bonded" bondAngle={0} bondReach={0.72} />
              <Orb element="O" size="md" state="bonded" bondAngle={180} bondReach={0.72} />
            </div>
            <figcaption>
              <b>Bonded</b>
            </figcaption>
          </figure>
        </div>
      </section>

      <section>
        <h2>Charges</h2>
        <div className="orb-showcase__grid">
          {CHARGE_SAMPLES.map((sample) => {
            const shown = sample.charge ?? ELEMENT_ORB_DEFINITIONS[sample.element].chargeBehavior.defaultCharge;
            return (
              <figure key={`${sample.element}${shown ?? ''}`}>
                <Orb element={sample.element} size="md" state="ionized" charge={sample.charge} />
                <figcaption>
                  <b>{sample.element}{shown}</b>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </section>

      <section>
        <h2>Sizes</h2>
        <div className="orb-showcase__sizes">
          {(Object.keys(ORB_SIZES) as OrbSize[]).map((name) => (
            <figure key={name}>
              <Orb element="O" size={name} />
              <figcaption>
                <b>{name.toUpperCase()}</b>
                <span>{ORB_SIZES[name]}px</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section ref={labRef} className="orb-showcase__lab">
        <h2>Animation</h2>
        <div className="orb-showcase__lab-layout">
          <div className="orb-showcase__stage">
            {focus.kind === 'element' ? (
              <Orb
                key={`${focusKey}-${labState}-${session}`}
                ref={orbRef}
                element={focus.element}
                size={labSize}
                state={labState}
                onAnimationComplete={setCompleted}
              />
            ) : (
              <Orb
                key={`${focusKey}-${labState}-${session}`}
                ref={orbRef}
                type={focus.type}
                size={labSize}
                state={labState}
                onAnimationComplete={setCompleted}
              />
            )}
            <p className="orb-showcase__api">
              {focus.kind === 'element'
                ? `<Orb element="${focus.element}" size="${labSize}" state="${labState}" />`
                : `<Orb type="${focus.type}" size="${labSize}" state="${labState}" />`}
            </p>
            <p className="orb-showcase__status">
              {completed ? `orb.animate("${completed}") complete` : 'orbRef.current?.animate(…)'}
            </p>
          </div>
          <div className="orb-showcase__controls">
            <div>
              <h3>animate()</h3>
              <div className="orb-showcase__pills">
                {ORB_ANIMATION_NAMES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setCompleted(null);
                      orbRef.current?.animate(name);
                    }}
                  >
                    {name}
                  </button>
                ))}
                <button type="button" onClick={() => { setLabState('normal'); setCompleted(null); setSession((value) => value + 1); }}>
                  reset
                </button>
              </div>
            </div>
            <div>
              <h3>state</h3>
              <div className="orb-showcase__pills">
                {ORB_STATES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={labState === name}
                    onClick={() => { setLabState(name); setCompleted(null); setSession((value) => value + 1); }}
                  >
                    {STATE_LABEL[name]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3>size</h3>
              <div className="orb-showcase__pills">
                {(Object.keys(ORB_SIZES) as OrbSize[]).map((name) => (
                  <button key={name} type="button" aria-pressed={labSize === name} onClick={() => setLabSize(name)}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>Field</h2>
        <div className="orb-showcase__field">
          {field.map((symbol, index) => (
            <Orb key={`${symbol}-${index}`} element={symbol} size={dense ? 'xs' : 'sm'} />
          ))}
        </div>
        <div className="orb-showcase__pills">
          <button type="button" aria-pressed={dense} onClick={() => setDense((value) => !value)}>
            {dense ? '140 orbs' : '48 orbs'}
          </button>
        </div>
      </section>
    </main>
  );
}

function StateCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure>
      {children}
      <figcaption>
        <b>{label}</b>
      </figcaption>
    </figure>
  );
}

const SHOWCASE_CSS = `
.orb-showcase {
  position: fixed;
  inset: 0;
  overflow: auto;
  z-index: 5;
  background:
    radial-gradient(ellipse 80% 42% at 50% -8%, #163064 0%, transparent 58%),
    radial-gradient(ellipse 50% 36% at 100% 100%, #0d2144 0%, transparent 60%),
    #070b14;
  color: #e7eefc;
  font-family: Inter, "Segoe UI", "Noto Sans", system-ui, sans-serif;
  padding: 36px 22px 72px;
}
.orb-showcase__header,
.orb-showcase section {
  width: min(1080px, 100%);
  margin: 0 auto;
}
.orb-showcase__header {
  margin-bottom: 28px;
}
.orb-showcase__header p {
  margin: 0 0 6px;
  color: #8ea4cc;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.orb-showcase h1 {
  margin: 0;
  font-size: 40px;
  font-weight: 600;
  letter-spacing: -0.04em;
}
.orb-showcase section {
  margin-top: 42px;
}
.orb-showcase h2 {
  margin: 0 0 18px;
  color: #8ea0c4;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.orb-showcase h3 {
  margin: 0 0 8px;
  color: #9aafd0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.orb-showcase__grid,
.orb-showcase__sizes,
.orb-showcase__field {
  display: grid;
  gap: 26px 12px;
}
.orb-showcase__grid {
  grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
}
.orb-showcase__grid--states {
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
}
.orb-showcase figure {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.orb-showcase figcaption {
  text-align: center;
  color: #93a6c8;
  font-size: 12px;
  line-height: 1.3;
}
.orb-showcase figcaption b {
  display: block;
  color: #eef3ff;
  font-weight: 600;
  font-size: 13px;
}
.orb-showcase__pick {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0;
  color: inherit;
  cursor: pointer;
  border-radius: 50%;
}
.orb-showcase__pick:focus-visible {
  outline: 2px solid #9dc2ff;
  outline-offset: 6px;
}
.orb-showcase__sizes {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 28px 32px;
}
.orb-showcase__pair {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 92px;
}
.orb-showcase__lab-layout {
  display: grid;
  grid-template-columns: minmax(220px, 320px) 1fr;
  gap: 28px;
  align-items: center;
}
.orb-showcase__stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  min-height: 240px;
  justify-content: center;
}
.orb-showcase__api,
.orb-showcase__status {
  margin: 0;
  text-align: center;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 12px;
  color: #b7c8e6;
}
.orb-showcase__status {
  color: #8ea4cc;
}
.orb-showcase__controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.orb-showcase__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.orb-showcase__pills button {
  appearance: none;
  border: 1px solid rgba(166, 196, 255, 0.2);
  background: rgba(10, 18, 36, 0.72);
  color: #d5e3f8;
  border-radius: 999px;
  padding: 8px 12px;
  font: 600 12px/1 Inter, "Segoe UI", system-ui, sans-serif;
  cursor: pointer;
}
.orb-showcase__pills button[aria-pressed="true"] {
  border-color: rgba(150, 196, 255, 0.85);
  background: rgba(36, 74, 150, 0.55);
  color: white;
}
.orb-showcase__field {
  grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
  gap: 18px 8px;
  justify-items: center;
  padding: 8px 0 16px;
}
@media (max-width: 720px) {
  .orb-showcase {
    padding: 24px 14px 56px;
  }
  .orb-showcase h1 {
    font-size: 32px;
  }
  .orb-showcase__lab-layout {
    grid-template-columns: 1fr;
  }
  .orb-showcase__grid {
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  }
}
`;
