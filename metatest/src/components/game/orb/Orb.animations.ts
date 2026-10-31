import type { OrbAnimationName, OrbState } from './Orb.types';

export interface OrbAnimationSpec {
  /** CSS keyframes name applied to the glass sphere. animationend uses this. */
  keyframes: string;
  durationMs: number;
  /** Steady visual state shown while the command is playing. */
  visualState: OrbState;
}

/**
 * Visual commands the reaction engine can trigger.
 * Durations live here so gameplay can line up with the picture without
 * importing the stylesheet.
 */
export const ORB_ANIMATIONS = {
  charge: {
    keyframes: 'chimball-orb-kf-charge',
    durationMs: 420,
    visualState: 'charged',
  },
  bond: {
    keyframes: 'chimball-orb-kf-bond',
    durationMs: 380,
    visualState: 'bonded',
  },
  react: {
    keyframes: 'chimball-orb-kf-react',
    durationMs: 680,
    visualState: 'reacting',
  },
  destroy: {
    keyframes: 'chimball-orb-kf-destroy',
    durationMs: 440,
    visualState: 'destroying',
  },
  freeze: {
    keyframes: 'chimball-orb-kf-freeze',
    durationMs: 460,
    visualState: 'frozen',
  },
  ionize: {
    keyframes: 'chimball-orb-kf-ionize',
    durationMs: 480,
    visualState: 'ionized',
  },
} as const satisfies Record<OrbAnimationName, OrbAnimationSpec>;

export const ORB_ANIMATION_NAMES = Object.keys(ORB_ANIMATIONS) as readonly OrbAnimationName[];
