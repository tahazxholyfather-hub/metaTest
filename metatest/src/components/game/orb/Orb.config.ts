import type { CSSProperties } from 'react';
import { ORB_ANIMATIONS } from './Orb.animations';
import { getElementDefinition, getPowerOrbDefinition } from './orbDefinitions';
import type {
  ElementOrbDefinition,
  ElementSymbol,
  OrbAnimationName,
  OrbCharge,
  OrbKind,
  OrbSize,
  OrbState,
  PowerOrbDefinition,
  PowerOrbType,
} from './Orb.types';

/** Glass diameter in pixels for the named gameplay steps. */
export const ORB_SIZES: Record<OrbSize, number> = {
  xs: 40,
  sm: 56,
  md: 76,
  lg: 108,
  xl: 148,
};

export const ORB_STATE_INTENSITY: Record<OrbState, number> = {
  normal: 1,
  selected: 1.16,
  aiming: 1,
  charged: 1.22,
  ionized: 1.18,
  bonded: 0.94,
  unstable: 1.02,
  frozen: 0.72,
  reacting: 1.32,
  destroying: 1.2,
  disabled: 0.16,
};

export function resolveOrbSize(size: OrbSize | number = 'md'): number {
  return typeof size === 'number' ? size : ORB_SIZES[size];
}

/** Bucket a pixel diameter into the nearest named step for style tweaks. */
export function sizeToken(size: OrbSize | number): OrbSize {
  if (typeof size === 'string') return size;
  if (size <= 46) return 'xs';
  if (size <= 64) return 'sm';
  if (size <= 90) return 'md';
  if (size <= 124) return 'lg';
  return 'xl';
}

export function symbolRatio(letters: number, charge: OrbCharge | null): number {
  const chargeWeight = !charge ? 0 : charge.length > 1 ? 0.85 : 0.45;
  const weight = letters + chargeWeight;
  if (weight <= 1.05) return 0.4;
  if (weight <= 2.05) return 0.3;
  if (weight <= 2.7) return 0.25;
  return 0.22;
}

export interface ResolvedOrbModel {
  kind: OrbKind;
  name: string;
  symbolText: string | null;
  definition: ElementOrbDefinition | PowerOrbDefinition;
  colors: {
    base: string;
    glow: string;
    core: string;
    rim: string;
  };
}

export function resolveOrbModel(
  kind: OrbKind,
  element: ElementSymbol | undefined,
): ResolvedOrbModel {
  if (kind === 'element') {
    const definition = getElementDefinition(element ?? 'H');
    return {
      kind,
      name: definition.name,
      symbolText: definition.symbol,
      definition,
      colors: {
        base: definition.baseColor,
        glow: definition.glowColor,
        core: definition.coreColor,
        rim: definition.rimColor,
      },
    };
  }
  const definition = getPowerOrbDefinition(kind as PowerOrbType);
  return {
    kind,
    name: definition.name,
    symbolText: null,
    definition,
    colors: {
      base: definition.baseColor,
      glow: definition.glowColor,
      core: definition.coreColor,
      rim: definition.rimColor,
    },
  };
}

export function resolveCharge(
  model: ResolvedOrbModel,
  state: OrbState,
  charge: OrbCharge | null | undefined,
): OrbCharge | null {
  if (model.kind !== 'element') return null;
  if (charge !== undefined) return charge;
  const definition = model.definition as ElementOrbDefinition;
  if ((state === 'ionized' || state === 'charged') && definition.ionizable) {
    return definition.chargeBehavior.defaultCharge;
  }
  return null;
}

export function phaseFromSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash + seed.charCodeAt(index) * (index + 3)) % 29;
  }
  return hash / 8;
}

export function orbCssVars(input: {
  sizePx: number;
  colors: ResolvedOrbModel['colors'];
  intensity: number;
  symbolRatio: number;
  aimAngle: number;
  bondAngle: number;
  bondReach: number;
  phase: number;
}): CSSProperties {
  const intensity = Math.min(1.8, Math.max(0, input.intensity));
  return {
    '--orb-size': `${input.sizePx}px`,
    '--orb-base': input.colors.base,
    '--orb-glow': input.colors.glow,
    '--orb-core': input.colors.core,
    '--orb-rim': input.colors.rim,
    '--orb-intensity': String(intensity),
    '--orb-symbol-ratio': String(input.symbolRatio),
    '--aim-angle': `${input.aimAngle}deg`,
    '--bond-angle': `${input.bondAngle}deg`,
    '--bond-reach': String(input.bondReach),
    '--orb-phase': String(input.phase),
  } as CSSProperties;
}

export function accessibleOrbName(
  model: ResolvedOrbModel,
  state: OrbState,
  charge: OrbCharge | null,
): string {
  const stateLabel = state === 'normal' ? '' : `, ${state}`;
  const chargeLabel = charge ? `, charge ${charge}` : '';
  return `${model.name} orb${stateLabel}${chargeLabel}`;
}

export function visualStateForAnimation(name: OrbAnimationName): OrbState {
  return ORB_ANIMATIONS[name].visualState;
}
