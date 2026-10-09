/** Body color themes for Met. Anatomy accents (mitochondrion, vesicle) stay fixed. */

export type CellColorName = 'violet' | 'blue' | 'green' | 'pink';

export interface CellTheme {
  /** Membrane radial gradient, center → rim (6 stops). */
  membrane: [string, string, string, string, string, string];
  rimTop: string;
  rimBot: string;
  bloom: string;
  /** Nucleus sphere gradient (4 stops) + its halo color. */
  nucleus: [string, string, string, string];
  nucGlow: string;
  /** Inner light pockets (core glow gradient, bright + mid). */
  coreA: string;
  coreB: string;
  /** Inner translucency edge stroke. */
  inner: string;
  /** Cytoplasm dots / zzz / sparkles. */
  dots: string;
  blush: string;
}

export const THEMES: Record<CellColorName, CellTheme> = {
  violet: {
    membrane: ['#401E7D', '#361766', '#411C80', '#5524A6', '#6D28D9', '#7C3AED'],
    rimTop: '#D8CCFF',
    rimBot: '#8B5CF6',
    bloom: '#7C3AED',
    nucleus: ['#A863F2', '#8241DC', '#6526B4', '#571FA0'],
    nucGlow: '#A855F7',
    coreA: '#A855F7',
    coreB: '#8B5CF6',
    inner: '#A78BFA',
    dots: '#C4B5FD',
    blush: '#F291DE',
  },
  blue: {
    membrane: ['#1D3E86', '#182F6C', '#1F418E', '#2452B4', '#2F66DE', '#3B82F6'],
    rimTop: '#CBE0FF',
    rimBot: '#60A5FA',
    bloom: '#2E6BEF',
    nucleus: ['#5FA0F6', '#3D7BE0', '#2A5CBB', '#2450A6'],
    nucGlow: '#60A5FA',
    coreA: '#60A5FA',
    coreB: '#3B82F6',
    inner: '#93C5FD',
    dots: '#BFDBFE',
    blush: '#F291DE',
  },
  green: {
    membrane: ['#125243', '#0E4436', '#155A46', '#1A7458', '#1F9569', '#22C08A'],
    rimTop: '#CDFBEA',
    rimBot: '#34D399',
    bloom: '#10B981',
    nucleus: ['#4ADE9E', '#2BBE7F', '#1E9765', '#198256'],
    nucGlow: '#34D399',
    coreA: '#34D399',
    coreB: '#10B981',
    inner: '#6EE7B7',
    dots: '#A7F3D0',
    blush: '#F9A8D4',
  },
  pink: {
    membrane: ['#701B51', '#5B1444', '#77205C', '#952970', '#C13390', '#EC4899'],
    rimTop: '#FFD3ED',
    rimBot: '#F472B6',
    bloom: '#EC4899',
    nucleus: ['#F477BE', '#DC4FA4', '#B43784', '#9C2F72'],
    nucGlow: '#F472B6',
    coreA: '#F472B6',
    coreB: '#EC4899',
    inner: '#F9A8D4',
    dots: '#FBCFE8',
    blush: '#FFC7DE',
  },
};

export const DEFAULT_COLOR: CellColorName = 'violet';
