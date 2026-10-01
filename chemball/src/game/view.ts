import type { VisualStyle } from "./types";

export interface ViewBall {
  x: number;
  y: number;
  r: number;
  scale: number;
  alpha: number;
  kind: "element" | "material";
  icon: string;
  glyph: string;
  formula: string;
  style: VisualStyle;
  frost: boolean;
  charge: -1 | 0 | 1;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  sub: string;
  life: number;
  max: number;
  color: string;
}

export interface ViewState {
  width: number;
  height: number;
  balls: ViewBall[];
  shot: ViewBall | null;
  trajectory: Array<{ x: number; y: number }>;
  ghost: { x: number; y: number } | null;
  particles: Particle[];
  floats: FloatText[];
  dangerY: number;
  launcherX: number;
  launcherY: number;
  aimAngle: number;
  current: ViewBall | null;
  next: ViewBall | null;
  shake: number;
  flash: number;
  splash: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  bolts: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  ring: { x: number; y: number; r: number; t: number; massive: boolean } | null;
  banner: string;
  bannerLife: number;
  guide: { x: number; y: number; r: number } | null;
  nextLabel: string;
}
