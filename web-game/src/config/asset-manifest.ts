export const IMAGES = {
  player: '/assets/images/player.png',
  enemy: '/assets/images/enemy.png',
  coin: '/assets/images/coin.png',
  platform: '/assets/images/platform.png',
  goal: '/assets/images/goal.png',
  heart: '/assets/images/heart.png',
  particle: '/assets/images/particle.png',
} as const;

export type ImageKey = keyof typeof IMAGES;

export const AUDIO = {
  music: {
    theme: '/assets/audio/music/theme.wav',
    victory: '/assets/audio/music/victory.wav',
  },
  sfx: {
    jump: '/assets/audio/sfx/jump.wav',
    coin: '/assets/audio/sfx/coin.wav',
    hit: '/assets/audio/sfx/hit.wav',
    stomp: '/assets/audio/sfx/stomp.wav',
    win: '/assets/audio/sfx/win.wav',
  },
} as const;

export const DATA = {
  level: '/assets/data/level.json',
} as const;

export const FONTS = {
  display: 'monospace',
} as const;

export const ATLAS = {} as const;
export const AUDIO_SPRITES = {} as const;
