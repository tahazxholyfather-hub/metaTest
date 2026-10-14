import type {
  ElementOrbDefinition,
  ElementSymbol,
  OrbCharge,
  OrbReaction,
  PowerOrbDefinition,
  PowerOrbType,
} from './Orb.types';
import { ELEMENT_SYMBOLS, POWER_ORB_TYPES } from './Orb.types';

/**
 * Element and power-orb catalog.
 * To add an element, append its symbol in Orb.types.ts and add one entry below.
 * Color, charge, and reactions are read from this file — there is no per-element component.
 */

const REACTION_TABLE: readonly OrbReaction[] = [
  { id: 'synthesis:H2O', with: ['H', 'O'], result: 'H2O' },
  { id: 'synthesis:CO2', with: ['C', 'O'], result: 'CO2' },
  { id: 'synthesis:NH3', with: ['N', 'H'], result: 'NH3' },
  { id: 'synthesis:HCl', with: ['H', 'Cl'], result: 'HCl' },
  { id: 'synthesis:HF', with: ['H', 'F'], result: 'HF' },
  { id: 'synthesis:HBr', with: ['H', 'Br'], result: 'HBr' },
  { id: 'synthesis:H2S', with: ['H', 'S'], result: 'H2S' },
  { id: 'synthesis:NaCl', with: ['Na', 'Cl'], result: 'NaCl' },
  { id: 'synthesis:KCl', with: ['K', 'Cl'], result: 'KCl' },
  { id: 'synthesis:KBr', with: ['K', 'Br'], result: 'KBr' },
  { id: 'synthesis:NaI', with: ['Na', 'I'], result: 'NaI' },
  { id: 'synthesis:CaCl2', with: ['Ca', 'Cl'], result: 'CaCl2' },
  { id: 'synthesis:MgCl2', with: ['Mg', 'Cl'], result: 'MgCl2' },
  { id: 'synthesis:SO2', with: ['S', 'O'], result: 'SO2' },
  { id: 'synthesis:MgO', with: ['Mg', 'O'], result: 'MgO' },
  { id: 'synthesis:CaO', with: ['Ca', 'O'], result: 'CaO' },
  { id: 'synthesis:FeO', with: ['Fe', 'O'], result: 'FeO' },
  { id: 'synthesis:Al2O3', with: ['Al', 'O'], result: 'Al2O3' },
  { id: 'synthesis:P4O10', with: ['P', 'O'], result: 'P4O10' },
];

function reactionsFor(symbol: ElementSymbol): readonly OrbReaction[] {
  return REACTION_TABLE.filter((reaction) => reaction.with.includes(symbol));
}

function charge(
  ionizable: boolean,
  defaultCharge: OrbCharge | null,
  possibleCharges: readonly OrbCharge[],
): Pick<ElementOrbDefinition, 'ionizable' | 'chargeBehavior'> {
  return {
    ionizable,
    chargeBehavior: { defaultCharge, possibleCharges },
  };
}

type ElementSeed = Omit<ElementOrbDefinition, 'kind' | 'reactions'>;

function element(seed: ElementSeed): ElementOrbDefinition {
  return {
    kind: 'element',
    ...seed,
    reactions: reactionsFor(seed.symbol),
  };
}

export const ELEMENT_ORB_DEFINITIONS: Record<ElementSymbol, ElementOrbDefinition> = {
  H: element({
    symbol: 'H',
    name: 'Hydrogen',
    baseColor: '#1F7BFF',
    glowColor: '#4DA6FF',
    coreColor: '#E7F3FF',
    rimColor: '#B9DCFF',
    sizeMultiplier: 0.78,
    ...charge(true, '+', ['+']),
    specialProperties: ['fuel', 'lightest'],
  }),
  O: element({
    symbol: 'O',
    name: 'Oxygen',
    baseColor: '#FF2A38',
    glowColor: '#FF5C68',
    coreColor: '#FFE3E6',
    rimColor: '#FFA0A8',
    sizeMultiplier: 0.9,
    ...charge(true, '2-', ['2-']),
    specialProperties: ['oxidizer', 'diatomic'],
  }),
  C: element({
    symbol: 'C',
    name: 'Carbon',
    baseColor: '#8B2CFF',
    glowColor: '#B56BFF',
    coreColor: '#F1E6FF',
    rimColor: '#D4B0FF',
    sizeMultiplier: 1,
    ...charge(false, null, []),
    specialProperties: ['structural', 'nonmetal'],
  }),
  N: element({
    symbol: 'N',
    name: 'Nitrogen',
    baseColor: '#14DC62',
    glowColor: '#5CFF9A',
    coreColor: '#E4FFE9',
    rimColor: '#A8FFC8',
    sizeMultiplier: 0.92,
    ...charge(true, '3-', ['3-']),
    specialProperties: ['diatomic', 'nonmetal'],
  }),
  S: element({
    symbol: 'S',
    name: 'Sulfur',
    baseColor: '#FFC400',
    glowColor: '#FFE066',
    coreColor: '#FFF4C4',
    rimColor: '#FFE99A',
    sizeMultiplier: 1.16,
    ...charge(true, '2-', ['2-']),
    specialProperties: ['combustible', 'nonmetal'],
  }),
  Cl: element({
    symbol: 'Cl',
    name: 'Chlorine',
    baseColor: '#00DCC0',
    glowColor: '#5DFFE8',
    coreColor: '#E4FFF8',
    rimColor: '#A8FFF0',
    sizeMultiplier: 1.14,
    ...charge(true, '-', ['-']),
    specialProperties: ['halogen', 'diatomic'],
  }),
  Na: element({
    symbol: 'Na',
    name: 'Sodium',
    baseColor: '#3A6BFF',
    glowColor: '#7C9FFF',
    coreColor: '#E5EDFF',
    rimColor: '#B7CBFF',
    sizeMultiplier: 1.36,
    ...charge(true, '+', ['+']),
    specialProperties: ['alkali-metal', 'highly-reactive'],
  }),
  K: element({
    symbol: 'K',
    name: 'Potassium',
    baseColor: '#9A2BFF',
    glowColor: '#C46BFF',
    coreColor: '#F3E6FF',
    rimColor: '#DDB3FF',
    sizeMultiplier: 1.58,
    ...charge(true, '+', ['+']),
    specialProperties: ['alkali-metal', 'highly-reactive'],
  }),
  Ca: element({
    symbol: 'Ca',
    name: 'Calcium',
    baseColor: '#8FCBFF',
    glowColor: '#C9E6FF',
    coreColor: '#F4FAFF',
    rimColor: '#E7F5FF',
    sizeMultiplier: 1.34,
    ...charge(true, '2+', ['2+']),
    specialProperties: ['alkaline-earth', 'metal'],
  }),
  Mg: element({
    symbol: 'Mg',
    name: 'Magnesium',
    baseColor: '#FF6A00',
    glowColor: '#FF9A45',
    coreColor: '#FFE3CC',
    rimColor: '#FFC08A',
    sizeMultiplier: 1.2,
    ...charge(true, '2+', ['2+']),
    specialProperties: ['alkaline-earth', 'combustible'],
  }),
  Fe: element({
    symbol: 'Fe',
    name: 'Iron',
    baseColor: '#00D0E8',
    glowColor: '#5CEEFF',
    coreColor: '#E4FBFF',
    rimColor: '#A8F6FF',
    sizeMultiplier: 1.18,
    ...charge(true, '2+', ['2+', '3+']),
    specialProperties: ['transition-metal', 'magnetic'],
  }),
  P: element({
    symbol: 'P',
    name: 'Phosphorus',
    baseColor: '#C026FF',
    glowColor: '#E08BFF',
    coreColor: '#F8E8FF',
    rimColor: '#EFC4FF',
    sizeMultiplier: 1.12,
    ...charge(false, null, []),
    specialProperties: ['nonmetal', 'reactive'],
  }),
  F: element({
    symbol: 'F',
    name: 'Fluorine',
    baseColor: '#FF2D95',
    glowColor: '#FF73BA',
    coreColor: '#FFE4F2',
    rimColor: '#FFB3DC',
    sizeMultiplier: 0.84,
    ...charge(true, '-', ['-']),
    specialProperties: ['halogen', 'most-electronegative'],
  }),
  Br: element({
    symbol: 'Br',
    name: 'Bromine',
    baseColor: '#00C8F0',
    glowColor: '#5CE6FF',
    coreColor: '#E4F9FF',
    rimColor: '#A6F2FF',
    sizeMultiplier: 1.24,
    ...charge(true, '-', ['-']),
    specialProperties: ['halogen', 'volatile'],
  }),
  I: element({
    symbol: 'I',
    name: 'Iodine',
    baseColor: '#FF2A2A',
    glowColor: '#FF6A6A',
    coreColor: '#FFE4E4',
    rimColor: '#FFA8A8',
    sizeMultiplier: 1.4,
    ...charge(true, '-', ['-']),
    specialProperties: ['halogen', 'dense'],
  }),
  Al: element({
    symbol: 'Al',
    name: 'Aluminum',
    baseColor: '#4C8DFF',
    glowColor: '#8CB6FF',
    coreColor: '#E8F1FF',
    rimColor: '#C5DBFF',
    sizeMultiplier: 1.16,
    ...charge(true, '3+', ['3+']),
    specialProperties: ['metal', 'amphoteric'],
  }),
};

export const POWER_ORB_DEFINITIONS: Record<PowerOrbType, PowerOrbDefinition> = {
  ion: {
    kind: 'ion',
    name: 'Ion',
    baseColor: '#1E8FFF',
    glowColor: '#67C6FF',
    coreColor: '#E7F6FF',
    rimColor: '#B4E4FF',
    sizeMultiplier: 1,
    specialProperties: ['applies-charge', 'conducts'],
  },
  catalyst: {
    kind: 'catalyst',
    name: 'Catalyst',
    baseColor: '#FF4A12',
    glowColor: '#FF8A3C',
    coreColor: '#FFE2CC',
    rimColor: '#FFB184',
    sizeMultiplier: 1,
    specialProperties: ['accelerates-reactions', 'heat'],
  },
  energy: {
    kind: 'energy',
    name: 'Energy',
    baseColor: '#A020F0',
    glowColor: '#D06BFF',
    coreColor: '#F6E8FF',
    rimColor: '#E2B8FF',
    sizeMultiplier: 1,
    specialProperties: ['amplifies', 'stored-charge'],
  },
  bond: {
    kind: 'bond',
    name: 'Bond',
    baseColor: '#00DC62',
    glowColor: '#5DFF9E',
    coreColor: '#E3FFED',
    rimColor: '#A6FFC8',
    sizeMultiplier: 1,
    specialProperties: ['links-neighbors', 'stabilizes'],
  },
  unstable: {
    kind: 'unstable',
    name: 'Unstable',
    baseColor: '#FFB800',
    glowColor: '#FFE14A',
    coreColor: '#FFF3C2',
    rimColor: '#FFE99A',
    sizeMultiplier: 1,
    specialProperties: ['timed-decay', 'chain-reaction'],
  },
  magnet: {
    kind: 'magnet',
    name: 'Magnet',
    baseColor: '#F02D9A',
    glowColor: '#FF78C8',
    coreColor: '#FFE3F4',
    rimColor: '#FFB6E4',
    sizeMultiplier: 1,
    specialProperties: ['attracts-ions', 'field'],
  },
  void: {
    kind: 'void',
    name: 'Void',
    baseColor: '#7A2BFF',
    glowColor: '#B06BFF',
    coreColor: '#E6D4FF',
    rimColor: '#D2B0FF',
    sizeMultiplier: 1,
    specialProperties: ['consumes-adjacent', 'nullifies'],
  },
  freeze: {
    kind: 'freeze',
    name: 'Freeze',
    baseColor: '#00C8F5',
    glowColor: '#67E9FF',
    coreColor: '#E5F9FF',
    rimColor: '#B6F3FF',
    sizeMultiplier: 1,
    specialProperties: ['suspends-motion', 'crystallize'],
  },
};

for (const symbol of ELEMENT_SYMBOLS) {
  if (ELEMENT_ORB_DEFINITIONS[symbol].symbol !== symbol) {
    throw new Error(`Orb definition mismatch for ${symbol}`);
  }
}

for (const type of POWER_ORB_TYPES) {
  if (POWER_ORB_DEFINITIONS[type].kind !== type) {
    throw new Error(`Power orb definition mismatch for ${type}`);
  }
}

export function getElementDefinition(symbol: ElementSymbol): ElementOrbDefinition {
  return ELEMENT_ORB_DEFINITIONS[symbol];
}

export function getPowerOrbDefinition(type: PowerOrbType): PowerOrbDefinition {
  return POWER_ORB_DEFINITIONS[type];
}

export function reactionsForElement(symbol: ElementSymbol): readonly OrbReaction[] {
  return ELEMENT_ORB_DEFINITIONS[symbol].reactions;
}

export { REACTION_TABLE };
