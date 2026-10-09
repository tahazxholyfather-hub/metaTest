export interface GameEventMap {
  'score-changed': { score: number };
  'coins-changed': { coins: number };
  'lives-changed': { lives: number };
  'run-ended': { score: number; coins: number; victory: boolean };
  paused: { paused: boolean };
}

export type GameEventName = keyof GameEventMap;
