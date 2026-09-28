export interface VisualStyle {
  base: string;
  glow: string;
  rim: string;
  ink: string;
}

export interface ElementDef {
  id: string;
  symbol: string;
  name: string;
  visualStyle: VisualStyle;
  rarity: number;
  tags: string[];
}

export type BehaviorId =
  | "splash-down"
  | "ignite"
  | "rise-push"
  | "dissolve"
  | "explode"
  | "freeze"
  | "lightning"
  | "shatter"
  | "vent"
  | "corrode";

export type SoundId =
  | "shoot"
  | "attach"
  | "react"
  | "match"
  | "explode"
  | "freeze"
  | "acid"
  | "steam"
  | "energy"
  | "discover"
  | "over"
  | "ui"
  | "splash"
  | "crystal";

export interface MaterialDef {
  id: string;
  name: string;
  formula: string;
  visual: VisualStyle;
  matchRequired: number;
  behavior: BehaviorId;
  onCreate?: BehaviorId;
  movement: "static" | "rising";
  reactions: string[];
  scoreValue: number;
  rarity: number;
  sound: SoundId;
}

export interface ReactantSpec {
  type: "element" | "material";
  id: string;
  count: number;
}

export interface ReactionDef {
  id: string;
  reactants: ReactantSpec[];
  products: { type: "material"; id: string }[];
  priority: number;
  minRequired: number;
  affectedRadius: number;
  transformation: "merge";
  visualEffect: string;
  soundEffect: SoundId;
  scoreValue: number;
  chainPotential: number;
  blastRadius?: number;
  consumeProduct?: boolean;
}

export type BallKind = "element" | "material";

export interface Ball {
  id: string;
  kind: BallKind;
  elementId?: string;
  materialId?: string;
  col: number;
  row: number;
  frozenShifts: number;
  impulse: number;
  riseSteps: number;
  born: number;
}

export interface Layout {
  width: number;
  height: number;
  cols: number;
  xSpacing: number;
  ySpacing: number;
  radius: number;
  drawRadius: number;
  originX: number;
  originY: number;
  launcherX: number;
  launcherY: number;
  dangerY: number;
  topLimit: number;
}

export interface RunStats {
  score: number;
  xp: number;
  maxCombo: number;
  reactionsCreated: number;
  materialsMatched: number;
  chainCount: number;
  objectsDestroyed: number;
  highestChain: number;
  duration: number;
}

export interface HudSnapshot {
  status: "playing" | "paused" | "gameover";
  score: number;
  combo: number;
  name: string;
  avatar: string;
  level: number;
  xp: number;
  bestScore: number;
  hint: boolean;
  sound: boolean;
  discovered: string[];
}

export interface DiscoveryNotice {
  id: string;
  reactionId: string;
  formula: string;
  product: string;
}

export interface RunSummary {
  score: number;
  xpEarned: number;
  bestScore: number;
  isRecord: boolean;
  maxCombo: number;
  reactionsCreated: number;
  materialsMatched: number;
  chainCount: number;
  highestChain: number;
  objectsDestroyed: number;
}
