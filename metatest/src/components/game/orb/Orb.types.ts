import type { CSSProperties, Ref } from 'react';

/** Gameplay diameters. Numeric sizes are pixels and follow board coordinates. */
export const ORB_SIZE_NAMES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
export type OrbSize = (typeof ORB_SIZE_NAMES)[number];

export const ORB_STATES = [
  'normal',
  'selected',
  'aiming',
  'charged',
  'ionized',
  'bonded',
  'unstable',
  'frozen',
  'reacting',
  'destroying',
  'disabled',
] as const;
export type OrbState = (typeof ORB_STATES)[number];

export const ELEMENT_SYMBOLS = [
  'H',
  'O',
  'C',
  'N',
  'S',
  'Cl',
  'Na',
  'K',
  'Ca',
  'Mg',
  'Fe',
  'P',
  'F',
  'Br',
  'I',
  'Al',
] as const;
export type ElementSymbol = (typeof ELEMENT_SYMBOLS)[number];

export const POWER_ORB_TYPES = [
  'ion',
  'catalyst',
  'energy',
  'bond',
  'unstable',
  'magnet',
  'void',
  'freeze',
] as const;
export type PowerOrbType = (typeof POWER_ORB_TYPES)[number];

export type OrbKind = 'element' | PowerOrbType;

export const ORB_CHARGES = ['+', '-', '2+', '2-', '3+', '3-'] as const;
export type OrbCharge = (typeof ORB_CHARGES)[number];

/** Data the future reaction engine can query. The orb never executes it. */
export interface OrbReaction {
  id: string;
  with: readonly ElementSymbol[];
  result: string;
}

export interface ChargeBehavior {
  defaultCharge: OrbCharge | null;
  possibleCharges: readonly OrbCharge[];
}

export interface ElementOrbDefinition {
  kind: 'element';
  symbol: ElementSymbol;
  name: string;
  baseColor: string;
  glowColor: string;
  coreColor: string;
  rimColor: string;
  /**
   * Relative body scale for a future physics representation.
   * The rendered diameter always comes from the `size` prop.
   */
  sizeMultiplier: number;
  reactions: readonly OrbReaction[];
  ionizable: boolean;
  chargeBehavior: ChargeBehavior;
  specialProperties: readonly string[];
}

export interface PowerOrbDefinition {
  kind: PowerOrbType;
  name: string;
  baseColor: string;
  glowColor: string;
  coreColor: string;
  rimColor: string;
  sizeMultiplier: number;
  specialProperties: readonly string[];
}

export type OrbDefinition = ElementOrbDefinition | PowerOrbDefinition;

export type OrbAnimationName = 'charge' | 'bond' | 'react' | 'destroy' | 'freeze' | 'ionize';

type OrbCommonProps = {
  /** Glass diameter. Named steps or a pixel length from gameplay coordinates. */
  size?: OrbSize | number;
  state?: OrbState;
  className?: string;
  style?: CSSProperties;
  /**
   * Ambient motion (idle pulse, flames, arcs).
   * Imperative `animate()` calls still play when this is false.
   */
  animated?: boolean;
  /** Glow strength. Defaults from the current state, typically around 0.2–1.4. */
  intensity?: number;
  /** Degrees clockwise from the right. The energy trail sits behind this heading. */
  aimAngle?: number;
  /** Degrees clockwise from the right, toward a bonded neighbor. */
  bondAngle?: number;
  /** Beam length as a fraction of the orb diameter. */
  bondReach?: number;
  /** Fires when a one-shot visual sequence finishes. */
  onAnimationComplete?: (name: OrbAnimationName) => void;
  ref?: Ref<OrbHandle>;
};

export type ElementOrbProps = OrbCommonProps & {
  type?: 'element';
  element: ElementSymbol;
  /**
   * Shown when set. Ionized and charged states fall back to the element default.
   * Pass null to suppress the default.
   */
  charge?: OrbCharge | null;
};

export type PowerOrbProps = OrbCommonProps & {
  type: PowerOrbType;
  element?: never;
  charge?: never;
};

export type OrbProps = ElementOrbProps | PowerOrbProps;

export interface OrbHandle {
  animate: (name: OrbAnimationName) => void;
  getElement: () => HTMLDivElement | null;
}
