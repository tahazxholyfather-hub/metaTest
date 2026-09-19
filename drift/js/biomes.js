/** Biome definitions and distance-based blending. */

export const BIOMES = [
  {
    id: 'forest',
    name: 'Forest',
    startM: 0,
    endM: 1000,
    palette: ['#2d4a2b', '#4a7c3a', '#8fb573', '#d4e4a8'],
    skyTop: '#1a2e28',
    skyBot: '#6a9a6a',
    fog: 0.08,
    particles: 'leaves',
    surface: 'grass',
    music: 'forest',
    dark: false,
  },
  {
    id: 'mountain',
    name: 'Mountain',
    startM: 1000,
    endM: 2500,
    palette: ['#3a3a4a', '#6a6a7a', '#a8a8b8', '#e0d8c8'],
    skyTop: '#2a3040',
    skyBot: '#8a90a0',
    fog: 0.18,
    particles: 'dust',
    surface: 'stone',
    music: 'mountain',
    dark: false,
  },
  {
    id: 'rain',
    name: 'Rain',
    startM: 2500,
    endM: 4000,
    palette: ['#2a3a4a', '#4a5a6a', '#7a8a9a', '#b8c8d8'],
    skyTop: '#1e2838',
    skyBot: '#5a6a7a',
    fog: 0.22,
    particles: 'rain',
    surface: 'wet',
    music: 'rain',
    dark: false,
  },
  {
    id: 'darkForest',
    name: 'Dark Forest',
    startM: 4000,
    endM: 5500,
    palette: ['#1a1a2a', '#2a2a3a', '#3a4a3a', '#5a6a5a'],
    skyTop: '#0a0a14',
    skyBot: '#1a2030',
    fog: 0.35,
    particles: 'spores',
    surface: 'mud',
    music: 'darkForest',
    dark: true,
  },
  {
    id: 'cave',
    name: 'Cave',
    startM: 5500,
    endM: 7000,
    palette: ['#1a1a1a', '#2a2a2a', '#4a3a2a', '#6a5a4a'],
    skyTop: '#080808',
    skyBot: '#1a1814',
    fog: 0.12,
    particles: 'drips',
    surface: 'stone',
    music: 'cave',
    dark: true,
  },
  {
    id: 'ice',
    name: 'Ice',
    startM: 7000,
    endM: 9000,
    palette: ['#4a6a8a', '#7a9aba', '#b8d4e8', '#e8f4f8'],
    skyTop: '#3a5070',
    skyBot: '#c8dce8',
    fog: 0.1,
    particles: 'snow',
    surface: 'ice',
    music: 'ice',
    dark: false,
  },
  {
    id: 'highAlt',
    name: 'High Altitude',
    startM: 9000,
    endM: 12000,
    palette: ['#6a7a9a', '#9aaccc', '#c8d4e8', '#f0e8d8'],
    skyTop: '#4a5878',
    skyBot: '#f8e8c8',
    fog: 0.06,
    particles: 'clouds',
    surface: 'stone',
    music: 'highAlt',
    dark: false,
  },
];

const TRANSITION_M = 350;

export function biomeAtDistance(meters) {
  const loopM = 12000;
  const m = ((meters % loopM) + loopM) % loopM;
  for (let i = 0; i < BIOMES.length; i++) {
    const b = BIOMES[i];
    if (m >= b.startM && m < b.endM) {
      const next = BIOMES[(i + 1) % BIOMES.length];
      const distToEnd = b.endM - m;
      if (distToEnd < TRANSITION_M && next) {
        const t = 1 - distToEnd / TRANSITION_M;
        return { current: b, next, blend: easeBlend(t) };
      }
      return { current: b, next: null, blend: 0 };
    }
  }
  return { current: BIOMES[0], next: null, blend: 0 };
}

function easeBlend(t) {
  return t * t * (3 - 2 * t);
}

export function blendedSky(info) {
  const { current, next, blend } = info;
  if (!next || blend <= 0) return { top: current.skyTop, bot: current.skyBot };
  return {
    top: lerpHex(current.skyTop, next.skyTop, blend),
    bot: lerpHex(current.skyBot, next.skyBot, blend),
  };
}

function lerpHex(a, b, t) {
  const parse = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

export function surfaceFriction(surface) {
  switch (surface) {
    case 'ice':
      return 0.35;
    case 'sand':
      return 1.8;
    case 'mud':
      return 2.8;
    case 'wet':
      return 0.55;
    case 'wood':
      return 1;
    default:
      return 1;
  }
}
