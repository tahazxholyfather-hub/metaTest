import {
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type AnimationEvent as ReactAnimationEvent,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ORB_ANIMATIONS } from './Orb.animations';
import {
  ORB_STATE_INTENSITY,
  accessibleOrbName,
  orbCssVars,
  phaseFromSeed,
  resolveCharge,
  resolveOrbModel,
  resolveOrbSize,
  sizeToken,
  symbolRatio,
  visualStateForAnimation,
} from './Orb.config';
import { ensureOrbStyles, orbClass } from './Orb.styles';
import type {
  OrbAnimationName,
  OrbCharge,
  OrbHandle,
  OrbKind,
  OrbProps,
  OrbState,
  PowerOrbType,
} from './Orb.types';

ensureOrbStyles();

const BURST_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

interface Playback {
  name: OrbAnimationName;
  token: number;
  armed: boolean;
}

function PowerMark({ type }: { type: PowerOrbType }) {
  switch (type) {
    case 'ion':
      return (
        <path
          fill="currentColor"
          d="M36 4 18 36h12L26 60l24-34H36L44 4H36Z"
        />
      );
    case 'catalyst':
      return (
        <g transform="scale(2.66667)">
          <path
            fill="currentColor"
            d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"
          />
        </g>
      );
    case 'energy':
      return (
        <>
          <circle cx="32" cy="32" r="3.4" fill="currentColor" />
          <ellipse cx="32" cy="32" rx="20" ry="7.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <ellipse cx="32" cy="32" rx="20" ry="7.5" fill="none" stroke="currentColor" strokeWidth="2.5" transform="rotate(60 32 32)" />
          <ellipse cx="32" cy="32" rx="20" ry="7.5" fill="none" stroke="currentColor" strokeWidth="2.5" transform="rotate(120 32 32)" />
        </>
      );
    case 'bond':
      return (
        <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round">
          <rect x="2" y="18" width="34" height="22" rx="11" transform="rotate(-40 19 29)" />
          <rect x="28" y="24" width="34" height="22" rx="11" transform="rotate(-40 45 35)" />
        </g>
      );
    case 'unstable':
      return (
        <>
          <path fill="currentColor" d="M21.5 9.5A25 25 0 0 1 42.5 9.5L36.2 23.2A10 10 0 0 0 27.8 23.2Z" />
          <path fill="currentColor" d="M21.5 9.5A25 25 0 0 1 42.5 9.5L36.2 23.2A10 10 0 0 0 27.8 23.2Z" transform="rotate(120 32 32)" />
          <path fill="currentColor" d="M21.5 9.5A25 25 0 0 1 42.5 9.5L36.2 23.2A10 10 0 0 0 27.8 23.2Z" transform="rotate(240 32 32)" />
          <circle cx="32" cy="32" r="4.2" fill="currentColor" />
        </>
      );
    case 'magnet':
      return (
        <path
          fill="currentColor"
          d="M16 14h10v22c0 8 12 8 12 0V14h10v24c0 14-32 14-32 0V14z"
        />
      );
    case 'void':
      return (
        <path
          d="M34 32c0-4 3-6 6-4 4 3 2 10-4 12-8 3-14-2-14-9 0-9 8-16 17-15 11 1 18 10 17 20-1 12-12 20-24 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.6"
          strokeLinecap="round"
        />
      );
    case 'freeze':
      return (
        <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
          <path d="M32 8v48M12 20l40 24M12 44l40-24" />
          <path d="M32 16 26 11M32 16l6-5M32 48l-6 5M32 48l6 5" />
          <path d="M20 24l-6-4M20 24l-2 7M44 24l6-4M44 24l2 7M20 40l-6 4M20 40l-2-7M44 40l6 4M44 40l2-7" />
        </g>
      );
    default:
      return null;
  }
}

function ArcFx({ variant }: { variant: 'ion' | 'charge' }) {
  const paths = variant === 'ion'
    ? ['M78 22c8 8 9 18 4 26', 'M20 68c-9-6-11-18-3-26', 'M74 72c7 6 6 14-1 18', 'M84 42l3 5-5 2 4 6']
    : ['M76 20c12 10 14 24 6 34', 'M22 74c-12-8-14-24-4-34'];
  return (
    <svg className={orbClass.fx} viewBox="0 0 100 100" aria-hidden="true">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
      {variant === 'charge' ? (
        <>
          <text x="14" y="30">+</text>
          <text x="74" y="78">−</text>
        </>
      ) : null}
    </svg>
  );
}

function CrackFx() {
  return (
    <svg className={orbClass.fx} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M24 32 34 44 22 60" />
      <path d="M74 28 62 44 76 62" />
      <path d="M42 18 48 34 40 42" />
      <path d="M58 70 50 56" />
    </svg>
  );
}

function FrostFx() {
  return (
    <div className={orbClass.frost} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <path d="M14 36 32 44 16 64" />
        <path d="M86 32 68 44 84 66" />
        <path d="M48 12 54 28" />
        <path d="M22 20 34 30" />
        <path d="M78 18 66 30" />
        <path d="M50 78 46 64" />
      </svg>
    </div>
  );
}

function OrbFx({ kind, state }: { kind: OrbKind; state: OrbState }) {
  if (state === 'frozen') return <FrostFx />;
  if (state === 'unstable' && kind !== 'unstable') return <CrackFx />;
  if (state === 'ionized' || kind === 'ion') return <ArcFx variant="ion" />;
  if (state === 'charged') return <ArcFx variant="charge" />;
  return null;
}

function Glyph({
  symbol,
  charge,
  power,
}: {
  symbol: string | null;
  charge: OrbCharge | null;
  power: PowerOrbType | null;
}) {
  if (power) {
    return (
      <svg className={orbClass.mark} viewBox="0 0 64 64" aria-hidden="true">
        <PowerMark type={power} />
      </svg>
    );
  }
  return (
    <span className={orbClass.formula}>
      {symbol}
      {charge ? <span className={orbClass.charge}>{charge.replaceAll('-', '−')}</span> : null}
    </span>
  );
}

function Burst() {
  return (
    <div className={orbClass.burst} aria-hidden="true">
      {BURST_ANGLES.map((angle, index) => (
        <span
          key={angle}
          style={{ '--a': `${angle}deg`, '--i': String(index) } as CSSProperties}
        />
      ))}
    </div>
  );
}

export const Orb = memo(function Orb(props: OrbProps) {
  const {
    ref,
    size = 'md',
    state = 'normal',
    className,
    style,
    animated = true,
    intensity,
    aimAngle = 0,
    bondAngle = 0,
    bondReach = 0.78,
    onAnimationComplete,
  } = props;

  const kind: OrbKind = props.type && props.type !== 'element' ? props.type : 'element';
  const element = kind === 'element' ? props.element : undefined;
  const chargeProp = kind === 'element' ? props.charge : undefined;

  const rootRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef(0);
  const completedRef = useRef<string | null>(null);
  const [clip, setClip] = useState<Playback | null>(null);
  const identity = kind === 'element' ? element : kind;
  const scope = `${identity ?? ''}:${state}`;
  const [clipScope, setClipScope] = useState(scope);
  let activeClip = clip;
  if (clipScope !== scope) {
    setClipScope(scope);
    setClip(null);
    activeClip = null;
  }

  const model = resolveOrbModel(kind, element);
  const autoName: OrbAnimationName | null =
    !activeClip && animated && state === 'reacting'
      ? 'react'
      : !activeClip && animated && state === 'destroying'
        ? 'destroy'
        : null;
  const playName = activeClip ? (activeClip.armed ? activeClip.name : null) : autoName;
  const visualState: OrbState = activeClip
    ? visualStateForAnimation(activeClip.name)
    : autoName
      ? visualStateForAnimation(autoName)
      : state;
  const shownCharge = resolveCharge(model, visualState, chargeProp);
  const letters = model.symbolText?.length ?? 1;
  const sizePx = resolveOrbSize(size);
  const vars = orbCssVars({
    sizePx,
    colors: model.colors,
    intensity: intensity ?? ORB_STATE_INTENSITY[visualState],
    symbolRatio: symbolRatio(letters, shownCharge),
    aimAngle,
    bondAngle,
    bondReach,
    phase: phaseFromSeed(model.symbolText ?? model.kind),
  });

  useImperativeHandle(
    ref,
    (): OrbHandle => ({
      animate(name) {
        completedRef.current = null;
        const token = tokenRef.current + 1;
        tokenRef.current = token;
        setClip({ name, token, armed: false });
      },
      getElement() {
        return rootRef.current;
      },
    }),
    [],
  );

  useEffect(() => {
    if (!activeClip || activeClip.armed) return;
    const token = activeClip.token;
    const frame = requestAnimationFrame(() => {
      setClip((current) =>
        current && current.token === token ? { ...current, armed: true } : current,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [activeClip]);

  const handleAnimationEnd = (event: ReactAnimationEvent<HTMLDivElement>) => {
    if (!playName) return;
    if (event.animationName !== ORB_ANIMATIONS[playName].keyframes) return;
    const target = event.target as HTMLElement;
    if (!target.classList?.contains(orbClass.sphere)) return;
    const key = `${playName}:${activeClip?.token ?? 'auto'}`;
    if (completedRef.current === key) return;
    completedRef.current = key;
    onAnimationComplete?.(playName);
  };

  const showTrail = visualState === 'aiming';
  const showBond = visualState === 'bonded';
  const showReact = visualState === 'reacting';
  const showDestroy = visualState === 'destroying';
  const power = kind === 'element' ? null : kind;

  const classNameValue = [orbClass.root, className].filter(Boolean).join(' ');

  let mark: ReactNode = null;
  if (power) mark = <PowerMark type={power} />;

  return (
    <div
      ref={rootRef}
      className={classNameValue}
      style={{ ...vars, ...style }}
      data-state={visualState}
      data-type={kind}
      data-size={sizeToken(size)}
      data-animated={animated ? 'true' : 'false'}
      data-play={playName ?? undefined}
      data-symbol={model.symbolText ?? undefined}
      data-letters={model.symbolText ? String(letters) : undefined}
      role="img"
      aria-label={accessibleOrbName(model, visualState, shownCharge)}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className={orbClass.halo} />
      <div className={orbClass.ground} />
      {showTrail ? (
        <div className={orbClass.trail}>
          <span className={orbClass.streak} />
        </div>
      ) : null}
      {showBond ? (
        <div className={orbClass.bond}>
          <span className={orbClass.beam} />
        </div>
      ) : null}
      {showDestroy ? <Burst /> : null}
      <div className={orbClass.sphere}>
        <div className={orbClass.core} />
        <div className={orbClass.crescent} />
        <div className={orbClass.specular} />
        <OrbFx kind={kind} state={visualState} />
        <div className={orbClass.glyph}>
          {power ? (
            <svg className={orbClass.mark} viewBox="0 0 64 64" aria-hidden="true">
              {mark}
            </svg>
          ) : (
            <Glyph symbol={model.symbolText} charge={shownCharge} power={null} />
          )}
        </div>
        {showReact ? (
          <>
            <span className={orbClass.ring} />
            <span className={`${orbClass.ring} ${orbClass.ringBurst}`} />
          </>
        ) : null}
        {showReact || showDestroy ? <span className={orbClass.flash} /> : null}
      </div>
    </div>
  );
});
