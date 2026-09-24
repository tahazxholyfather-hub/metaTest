export interface Vec2 {
  x: number;
  y: number;
}

export interface PlatformDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EnemyDef {
  x: number;
  y: number;
  left: number;
  right: number;
}

export interface LevelData {
  world: { width: number; height: number };
  spawn: Vec2;
  goal: Vec2;
  platforms: PlatformDef[];
  coins: Vec2[];
  enemies: EnemyDef[];
}

export interface SaveData {
  version: number;
  highScore: number;
  muted: boolean;
  musicVolume: number;
  sfxVolume: number;
}

export interface RunState {
  score: number;
  coins: number;
  lives: number;
  victory: boolean;
}

export type GameAction = 'left' | 'right' | 'jump' | 'pause';

export interface KeyState {
  down: boolean;
  justPressed: boolean;
  justReleased: boolean;
}

export interface PointerState {
  x: number;
  y: number;
  down: boolean;
  justPressed: boolean;
  justReleased: boolean;
}

export const SAVE_VERSION = 1;

export const defaultSave = (): SaveData => ({
  version: SAVE_VERSION,
  highScore: 0,
  muted: false,
  musicVolume: 0.45,
  sfxVolume: 0.8,
});
