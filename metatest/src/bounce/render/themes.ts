import type { ThemeId } from '../types'

export interface Theme {
  id: ThemeId
  skyTop: number
  skyBottom: number
  hillFar: number
  hillMid: number
  cloud: number
  grass: number
  earth: number
  earthDeep: number
  plank: number
  plankEdge: number
  spike: number
  water: number
  bounce: number
  coin: number
  coinSecret: number
  checkpoint: number
  goal: number
  gate: number
  hazard: number
  shadow: number
  switchOff: number
  switchOn: number
  accent: number
}

export const THEMES: Record<ThemeId, Theme> = {
  meadow: {
    id: 'meadow',
    skyTop: 0x9fd4f2,
    skyBottom: 0xe7f6c9,
    hillFar: 0x8fbfcf,
    hillMid: 0x6ea36a,
    cloud: 0xffffff,
    grass: 0x7dce63,
    earth: 0x4f8a45,
    earthDeep: 0x3d6b38,
    plank: 0xd7b072,
    plankEdge: 0x8a6239,
    spike: 0xd4543c,
    water: 0x3aa0c8,
    bounce: 0xf2c14e,
    coin: 0xf4d35e,
    coinSecret: 0xe7e2ff,
    checkpoint: 0x8b5cf6,
    goal: 0xf2c14e,
    gate: 0x3c4a38,
    hazard: 0xc23b3b,
    shadow: 0x1c2a18,
    switchOff: 0x6b5a42,
    switchOn: 0x6dce7a,
    accent: 0x8b5cf6,
  },
  canyon: {
    id: 'canyon',
    skyTop: 0xf2c09a,
    skyBottom: 0xf7e2c4,
    hillFar: 0xe09a72,
    hillMid: 0xc46a48,
    cloud: 0xfff1e0,
    grass: 0xe8a15a,
    earth: 0xb5653d,
    earthDeep: 0x8a4632,
    plank: 0xe6c48a,
    plankEdge: 0x7a4a32,
    spike: 0x8e2e2e,
    water: 0x3d8ea8,
    bounce: 0xffd166,
    coin: 0xffd166,
    coinSecret: 0xfff6e4,
    checkpoint: 0x8b5cf6,
    goal: 0xffd166,
    gate: 0x4a3028,
    hazard: 0xa32020,
    shadow: 0x3a2018,
    switchOff: 0x6e5344,
    switchOn: 0x7dce86,
    accent: 0x8b5cf6,
  },
  cove: {
    id: 'cove',
    skyTop: 0x8fd0d4,
    skyBottom: 0xd8f3ef,
    hillFar: 0x6aafc4,
    hillMid: 0x3e8f8a,
    cloud: 0xf4fffe,
    grass: 0xe6d3a3,
    earth: 0xc4a574,
    earthDeep: 0x8d7356,
    plank: 0xf0e2c0,
    plankEdge: 0x8a6a42,
    spike: 0xc4524a,
    water: 0x2f8f9e,
    bounce: 0xf2d16b,
    coin: 0xf2d16b,
    coinSecret: 0xe4fbff,
    checkpoint: 0x8b5cf6,
    goal: 0x7ddec8,
    gate: 0x2c4a4a,
    hazard: 0xb33a3a,
    shadow: 0x163038,
    switchOff: 0x5c6a62,
    switchOn: 0x7ddec8,
    accent: 0x8b5cf6,
  },
  ridge: {
    id: 'ridge',
    skyTop: 0xd5e2ee,
    skyBottom: 0xf7f5f0,
    hillFar: 0xb7c5d4,
    hillMid: 0x8e9bab,
    cloud: 0xffffff,
    grass: 0xdfe7ee,
    earth: 0x8d97a3,
    earthDeep: 0x66707c,
    plank: 0xc5ced6,
    plankEdge: 0x5c6770,
    spike: 0xb54848,
    water: 0x6aa4c4,
    bounce: 0xf0d78c,
    coin: 0xf0d78c,
    coinSecret: 0xffffff,
    checkpoint: 0x8b5cf6,
    goal: 0xf7f3ea,
    gate: 0x3e4650,
    hazard: 0xb33b3b,
    shadow: 0x2a3138,
    switchOff: 0x5c6570,
    switchOn: 0x8fd39a,
    accent: 0x8b5cf6,
  },
  dusk: {
    id: 'dusk',
    skyTop: 0x2a2348,
    skyBottom: 0xe38a62,
    hillFar: 0x3a315c,
    hillMid: 0x5a3d55,
    cloud: 0xc9b8e0,
    grass: 0x6d5a78,
    earth: 0x4a3c58,
    earthDeep: 0x2e243c,
    plank: 0xc4a27a,
    plankEdge: 0x5a4030,
    spike: 0xd4543c,
    water: 0x3a6e88,
    bounce: 0xf2c14e,
    coin: 0xf2c14e,
    coinSecret: 0xe7e2ff,
    checkpoint: 0xc9b8ff,
    goal: 0xf2c14e,
    gate: 0x241c30,
    hazard: 0xd4543c,
    shadow: 0x120c18,
    switchOff: 0x6a5a78,
    switchOn: 0xc9b8ff,
    accent: 0xc9b8ff,
  },
}

export function themeOf(id: ThemeId): Theme {
  return THEMES[id]
}

export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255
  const ag = (a >> 8) & 255
  const ab = a & 255
  const br = (b >> 16) & 255
  const bg = (b >> 8) & 255
  const bb = b & 255
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bl
}
