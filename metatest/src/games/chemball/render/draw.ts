import {
  Anvil,
  Atom,
  Bomb,
  Cloud,
  CloudFog,
  Droplets,
  Flame,
  FlaskConical,
  Gem,
  Snowflake,
  Zap,
  type IconNode,
} from "lucide";
import { ELEMENTS } from "../data/elements";
import { MATERIALS } from "../data/materials";
import { materialTex } from "../game/labels";
import type { ViewBall, ViewState } from "../game/view";
import { chemImage } from "./chem";

const NUMBER_FONT = '"Russo One", "JetBrains Mono", monospace';
const PLAYFIELD = "#0B0B10";
/** The start button uses `--accent` (`#8B5CF6`). Read that token from the game root. */
const AIM_FALLBACK = "#8B5CF6";
const ELEMENT_WEIGHT = 34;
const MATERIAL_WEIGHT = 18;

const MATERIAL_ICONS: Record<string, IconNode> = {
  water: Droplets,
  fire: Flame,
  steam: Cloud,
  acid: FlaskConical,
  explosive: Bomb,
  ice: Snowflake,
  energy: Zap,
  crystal: Gem,
  smoke: CloudFog,
  corrosion: Anvil,
  charged: Atom,
};

const pathCache = new Map<string, Path2D>();
const fillCache = new Map<string, string>();
let formulasReady = false;
let aimColor = "";

export function renderFrame(ctx: CanvasRenderingContext2D, view: ViewState, dpr: number): void {
  warmFormulas();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = PLAYFIELD;
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.save();
  if (view.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
  }
  drawDanger(ctx, view);
  drawTrajectory(ctx, view);
  for (const ball of view.balls) drawBall(ctx, ball);
  if (view.ghost) drawGhost(ctx, view);
  for (const splash of view.splash) drawSplash(ctx, splash.x1, splash.y1, splash.x2, splash.y2);
  for (const bolt of view.bolts) drawBolt(ctx, bolt.x1, bolt.y1, bolt.x2, bolt.y2);
  if (view.ring) drawRing(ctx, view.ring);
  for (const particle of view.particles) drawParticle(ctx, particle);
  ctx.globalAlpha = 1;
  if (view.shot) drawBall(ctx, view.shot);
  drawLauncher(ctx, view);
  if (view.current) drawBall(ctx, view.current);
  if (view.armed && view.current) drawArmed(ctx, view.current, view.armed);
  if (view.next) {
    drawBall(ctx, view.next);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#d5e4ff";
    ctx.font = "600 12px Vazirmatn, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("بعدی", view.next.x, view.next.y - view.next.r * view.next.scale - 8);
    ctx.globalAlpha = 1;
  }
  for (const float of view.floats) drawFloat(ctx, float);
  if (view.banner && view.bannerLife > 0) drawBanner(ctx, view);
  ctx.restore();
  if (view.chill > 0.01) drawChill(ctx, view);
  if (view.flash > 0.01) {
    ctx.fillStyle = `rgba(255,244,220,${view.flash * 0.28})`;
    ctx.fillRect(0, 0, view.width, view.height);
  }
}

function warmFormulas(): void {
  if (formulasReady) return;
  const first = ELEMENTS[0];
  if (!first || !chemImage(first.symbol, first.visualStyle.base, ELEMENT_WEIGHT)) return;
  formulasReady = true;
  for (const element of ELEMENTS) chemImage(element.symbol, element.visualStyle.base, ELEMENT_WEIGHT);
  for (const material of MATERIALS) {
    const tex = materialTex(material.id);
    if (tex) chemImage(tex, material.visual.base, MATERIAL_WEIGHT);
  }
}

function themeAim(): string {
  if (aimColor) return aimColor;
  if (typeof document !== "undefined") {
    const root = document.querySelector(".chemball-root");
    const value = root ? getComputedStyle(root).getPropertyValue("--accent").trim() : "";
    if (value) {
      aimColor = value;
      return aimColor;
    }
  }
  return AIM_FALLBACK;
}

function drawDanger(ctx: CanvasRenderingContext2D, view: ViewState): void {
  ctx.save();
  ctx.setLineDash([4, 9]);
  ctx.strokeStyle = "rgba(255, 150, 160, 0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(18, view.dangerY);
  ctx.lineTo(view.width - 18, view.dangerY);
  ctx.stroke();
  ctx.restore();
}

function drawTrajectory(ctx: CanvasRenderingContext2D, view: ViewState): void {
  const points = view.trajectory;
  if (!points.length) return;
  const tint = themeAim();
  ctx.save();
  ctx.strokeStyle = tint;
  ctx.fillStyle = tint;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i]!.x, points[i]!.y);
  ctx.stroke();
  const end = points[points.length - 1]!;
  ctx.beginPath();
  ctx.arc(end.x, end.y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGhost(ctx: CanvasRenderingContext2D, view: ViewState): void {
  if (!view.ghost) return;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = themeAim();
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.arc(view.ghost.x, view.ghost.y, (view.current?.r ?? 18) * 0.92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawLauncher(ctx: CanvasRenderingContext2D, view: ViewState): void {
  const { launcherX: x, launcherY: y, aimAngle } = view;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(6, 8, 16, 0.55)";
  ctx.beginPath();
  ctx.ellipse(0, 16, 54, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(aimAngle + Math.PI / 2);
  ctx.strokeStyle = themeAim();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(0, -18);
  ctx.stroke();
  ctx.fillStyle = themeAim();
  ctx.beginPath();
  ctx.arc(0, -18, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, (view.current?.r ?? 20) + 7, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
}

function drawArmed(ctx: CanvasRenderingContext2D, ball: ViewBall, armed: string): void {
  const radius = ball.r * ball.scale + 7;
  ctx.save();
  ctx.strokeStyle = armedColor(armed);
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, ball: ViewBall): void {
  const radius = ball.r * ball.scale;
  if (radius < 2 || ball.alpha <= 0.02) return;
  const { x, y, style } = ball;
  const ink = style.base;
  const line = Math.max(2.25, Math.min(radius * 0.085, 3.5));
  const inner = Math.max(4, radius - line);
  ctx.globalAlpha = ball.alpha;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = ballFill(ink);
  ctx.fill();
  ctx.lineWidth = line;
  ctx.strokeStyle = ink;
  ctx.stroke();
  if (ball.kind === "material") {
    const icon = MATERIAL_ICONS[ball.icon] ?? Atom;
    const hasFormula = ball.glyph.length > 0;
    const iconSize = inner * (hasFormula ? 0.72 : 1.05);
    strokeIcon(ctx, icon, x, y - (hasFormula ? inner * 0.22 : 0), iconSize, ink);
    if (hasFormula) {
      drawFormula(ctx, ball.glyph, x, y + inner * 0.42, inner * 1.55, inner * 0.5, ink, MATERIAL_WEIGHT);
    }
  } else {
    const height = inner * (ball.glyph.length > 1 ? 0.95 : 1.15);
    drawFormula(ctx, ball.glyph, x, y, inner * 1.6, height, ink, ELEMENT_WEIGHT);
  }
  if (ball.frost) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.arc(x, y, inner * 0.78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
}

/** Draws a MathJax formula centered at (x, y), fitted inside maxWidth × height. Falls back to text while decoding. */
function drawFormula(
  ctx: CanvasRenderingContext2D,
  tex: string,
  x: number,
  y: number,
  maxWidth: number,
  height: number,
  color: string,
  weight: number,
): void {
  const chem = chemImage(tex, color, weight);
  if (!chem) {
    const plain = tex.replace(/[()+-]/g, "");
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let size = height * 0.8;
    ctx.font = `600 ${size}px "Times New Roman", serif`;
    const measured = ctx.measureText(plain).width;
    if (measured > maxWidth && measured > 0) {
      size *= maxWidth / measured;
      ctx.font = `600 ${size}px "Times New Roman", serif`;
    }
    ctx.fillText(plain, x, y);
    return;
  }
  const scale = Math.min(height / chem.height, maxWidth / chem.width);
  const w = chem.width * scale;
  const h = chem.height * scale;
  ctx.drawImage(chem.image, x - w / 2, y - h / 2, w, h);
}

function strokeIcon(
  ctx: CanvasRenderingContext2D,
  node: IconNode,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [tag, attrs] of node) drawSvgTag(ctx, tag, attrs);
  ctx.restore();
}

function drawSvgTag(ctx: CanvasRenderingContext2D, tag: string, attrs: IconNode[number][1]): void {
  if (tag === "path" && attrs.d) {
    const d = String(attrs.d);
    let path = pathCache.get(d);
    if (!path) {
      path = new Path2D(d);
      pathCache.set(d, path);
    }
    ctx.stroke(path);
    return;
  }
  if (tag === "circle") {
    ctx.beginPath();
    ctx.arc(num(attrs.cx), num(attrs.cy), num(attrs.r), 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  if (tag === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(num(attrs.cx), num(attrs.cy), num(attrs.rx), num(attrs.ry), 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  if (tag === "line") {
    ctx.beginPath();
    ctx.moveTo(num(attrs.x1), num(attrs.y1));
    ctx.lineTo(num(attrs.x2), num(attrs.y2));
    ctx.stroke();
    return;
  }
  if (tag === "rect") {
    ctx.beginPath();
    const rx = num(attrs.rx);
    if (rx > 0 && "roundRect" in ctx) ctx.roundRect(num(attrs.x), num(attrs.y), num(attrs.width), num(attrs.height), rx);
    else ctx.rect(num(attrs.x), num(attrs.y), num(attrs.width), num(attrs.height));
    ctx.stroke();
    return;
  }
  if (tag === "polyline" || tag === "polygon") {
    const pts = String(attrs.points ?? "")
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (pts.length < 4) return;
    ctx.beginPath();
    ctx.moveTo(pts[0]!, pts[1]!);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
    if (tag === "polygon") ctx.closePath();
    ctx.stroke();
  }
}

function drawParticle(ctx: CanvasRenderingContext2D, particle: ViewState["particles"][number]): void {
  const alpha = Math.max(0, particle.life / particle.max);
  if (alpha <= 0.02) return;
  ctx.fillStyle = particle.color;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
  ctx.fill();
}

function drawSplash(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.save();
  ctx.strokeStyle = "rgba(150, 210, 255, 0.7)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.fillStyle = "rgba(220, 245, 255, 0.9)";
  ctx.beginPath();
  ctx.arc(x2, y2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBolt(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 236, 140, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const midX = (x1 + x2) / 2 + (y2 - y1) * 0.08;
  const midY = (y1 + y2) / 2 + (x1 - x2) * 0.08;
  ctx.lineTo(midX, midY);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawRing(ctx: CanvasRenderingContext2D, ring: NonNullable<ViewState["ring"]>): void {
  ctx.save();
  ctx.globalAlpha = (1 - ring.t) * 0.85;
  ctx.strokeStyle = ring.color;
  ctx.lineWidth = ring.massive ? 3 : 2;
  ctx.beginPath();
  ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawFloat(ctx: CanvasRenderingContext2D, float: ViewState["floats"][number]): void {
  const age = 1 - Math.max(0, float.life / float.max);
  const alpha = age < 0.62 ? 1 : Math.max(0, 1 - (age - 0.62) / 0.38);
  let scale = 1.08;
  if (age < 0.1) scale = 0.28 + (age / 0.1) * 1.22;
  else if (age < 0.22) scale = 1.5 - ((age - 0.1) / 0.12) * 0.42;
  scale *= float.pop;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(float.x, float.y);
  ctx.scale(scale, scale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `38px ${NUMBER_FONT}`;
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#07090d";
  ctx.strokeText(float.text, 0, -4);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(float.text, 0, -4);
  ctx.font = "700 15px Vazirmatn, sans-serif";
  ctx.lineWidth = 3;
  ctx.strokeText(float.sub, 0, 26);
  ctx.fillStyle = float.color;
  ctx.fillText(float.sub, 0, 26);
  ctx.restore();
}

function drawBanner(ctx: CanvasRenderingContext2D, view: ViewState): void {
  const intro = Math.min(1, Math.max(0, (1.55 - view.bannerLife) / 0.18));
  const scale = 0.7 + intro * 0.38;
  ctx.save();
  ctx.globalAlpha = Math.min(1, view.bannerLife);
  ctx.translate(view.width / 2, view.height * 0.34);
  ctx.scale(scale, scale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 34px Vazirmatn, sans-serif";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#07090d";
  ctx.strokeText(view.banner, 0, 0);
  ctx.fillStyle = "#fff6d4";
  ctx.fillText(view.banner, 0, 0);
  ctx.restore();
}

function drawChill(ctx: CanvasRenderingContext2D, view: ViewState): void {
  const { width } = view;
  ctx.fillStyle = `rgba(120, 190, 230, ${0.12 * view.chill})`;
  ctx.fillRect(0, 0, width, view.dangerY);
  ctx.save();
  ctx.globalAlpha = view.chill;
  ctx.strokeStyle = "#bfefff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(14, view.dangerY);
  ctx.lineTo(width - 14, view.dangerY);
  ctx.stroke();
  ctx.restore();
}

function armedColor(id: string): string {
  if (id === "burner") return "#ff9a4a";
  return "#b6e36a";
}

function ballFill(base: string): string {
  const cached = fillCache.get(base);
  if (cached) return cached;
  const fill = mixHex(base, "#07090d", 0.84);
  fillCache.set(base, fill);
  return fill;
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const u = Math.max(0, Math.min(1, t));
  const mixed = pa.map((channel, index) => Math.round(channel + (pb[index]! - channel) * u));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function num(value: string | number | undefined): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}
