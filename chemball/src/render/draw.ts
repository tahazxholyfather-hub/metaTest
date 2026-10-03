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
import type { ViewBall, ViewState } from "../game/view";

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
let backdrop: { key: string; canvas: HTMLCanvasElement } | null = null;

export function renderFrame(ctx: CanvasRenderingContext2D, view: ViewState, dpr: number): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, view.width, view.height);
  drawBackdrop(ctx, view.width, view.height);
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
  if (view.flash > 0.01) {
    ctx.fillStyle = `rgba(255,244,220,${view.flash * 0.35})`;
    ctx.fillRect(0, 0, view.width, view.height);
  }
  const vignette = ctx.createRadialGradient(
    view.width / 2,
    view.height * 0.45,
    view.height * 0.2,
    view.width / 2,
    view.height * 0.5,
    view.height * 0.72,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, view.width, view.height);
}

function drawBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const key = `${Math.round(width)}x${Math.round(height)}`;
  if (!backdrop || backdrop.key !== key) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const g = canvas.getContext("2d");
    if (!g) return;
    const sky = g.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#121028");
    sky.addColorStop(0.45, "#0c1022");
    sky.addColorStop(1, "#160d22");
    g.fillStyle = sky;
    g.fillRect(0, 0, width, height);
    g.fillStyle = "rgba(120, 90, 255, 0.16)";
    g.beginPath();
    g.ellipse(width * 0.5, height * 0.15, width * 0.55, height * 0.18, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(40, 120, 180, 0.08)";
    g.beginPath();
    g.ellipse(width * 0.2, height * 0.7, width * 0.4, height * 0.2, 0.4, 0, Math.PI * 2);
    g.fill();
    backdrop = { key, canvas };
  }
  ctx.drawImage(backdrop.canvas, 0, 0, width, height);
  const time = performance.now() / 1000;
  ctx.fillStyle = "rgba(210, 230, 255, 0.35)";
  for (let i = 0; i < 18; i += 1) {
    const x = (width * (i * 0.17 + 0.05) + Math.sin(time * 0.15 + i) * 12) % width;
    const y = (height * ((i * 0.37) % 1) + time * (6 + (i % 5))) % height;
    ctx.globalAlpha = 0.15 + (i % 4) * 0.05;
    ctx.beginPath();
    ctx.arc(x, y, 1.2 + (i % 3) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawDanger(ctx: CanvasRenderingContext2D, view: ViewState): void {
  const fade = ctx.createLinearGradient(0, view.dangerY - 10, 0, view.height);
  fade.addColorStop(0, "rgba(255, 64, 96, 0)");
  fade.addColorStop(1, "rgba(255, 50, 80, 0.14)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, view.dangerY, view.width, view.height - view.dangerY);
  ctx.save();
  ctx.setLineDash([4, 9]);
  ctx.strokeStyle = "rgba(255, 150, 160, 0.28)";
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
  const tint = view.current ? signColor(view.current.style.base) : "#e7f4ff";
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i]!;
    ctx.globalAlpha = 0.16 + (i / points.length) * 0.5;
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.arc(point.x, point.y, i === points.length - 1 ? 3.2 : 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawGhost(ctx: CanvasRenderingContext2D, view: ViewState): void {
  if (!view.ghost) return;
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.strokeStyle = view.current ? signColor(view.current.style.base) : "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1.6;
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
  ctx.strokeStyle = "rgba(190, 220, 255, 0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(0, -18);
  ctx.stroke();
  ctx.fillStyle = "rgba(160, 210, 255, 0.85)";
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
  const radius = ball.r * ball.scale + 6;
  const pulse = 0.65 + Math.sin(performance.now() / 220) * 0.35;
  ctx.save();
  ctx.globalAlpha = 0.45 + pulse * 0.4;
  ctx.strokeStyle = armedColor(armed);
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, ball: ViewBall): void {
  const radius = ball.r * ball.scale;
  if (radius < 2 || ball.alpha <= 0.02) return;
  const { x, y, style } = ball;
  const ink = signColor(style.base);
  const wash = mixHex(style.base, "#ffffff", 0.74);
  const mid = mixHex(style.base, "#ffffff", 0.58);
  const edge = mixHex(style.base, "#ffffff", 0.34);
  ctx.save();
  ctx.globalAlpha = ball.alpha;
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(x, y + radius * 0.9, radius * 0.62, radius * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  const gradient = ctx.createRadialGradient(x - radius * 0.36, y - radius * 0.42, radius * 0.05, x, y + radius * 0.08, radius);
  gradient.addColorStop(0, "rgba(255,255,255,0.98)");
  gradient.addColorStop(0.18, wash);
  gradient.addColorStop(0.62, mid);
  gradient.addColorStop(1, edge);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = mixHex(style.base, "#ffffff", 0.2);
  ctx.globalAlpha = ball.alpha * 0.16;
  ctx.beginPath();
  ctx.ellipse(x, y + radius * 0.48, radius * 0.78, radius * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = ball.alpha;
  ctx.lineWidth = Math.max(1.1, radius * 0.045);
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.beginPath();
  ctx.arc(x, y, radius - 0.6, 0, Math.PI * 2);
  ctx.stroke();
  const shine = 0.42 + Math.sin(performance.now() / 900 + x * 0.02) * 0.08;
  ctx.globalAlpha = ball.alpha * shine;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.ellipse(x - radius * 0.28, y - radius * 0.34, radius * 0.28, radius * 0.15, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = ball.alpha;
  if (ball.kind === "material") {
    const icon = MATERIAL_ICONS[ball.icon] ?? Atom;
    const lively = ball.icon === "fire" || ball.icon === "energy" || ball.icon === "steam" || ball.icon === "charged";
    const breathe = 1 + Math.sin(performance.now() / (lively ? 280 : 700) + y) * (lively ? 0.07 : 0.03);
    const hasFormula = ball.glyph.length > 0;
    strokeIcon(ctx, icon, x, y - (hasFormula ? radius * 0.12 : 0), radius * 1.05 * breathe, ink);
    if (hasFormula) {
      ctx.fillStyle = ink;
      ctx.globalAlpha = ball.alpha * 0.9;
      ctx.font = `600 ${Math.max(8, radius * 0.3)}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ball.glyph, x, y + radius * 0.46);
    }
  } else {
    ctx.fillStyle = ink;
    ctx.font = `600 ${radius * (ball.glyph.length > 1 ? 0.46 : 0.62)}px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ball.glyph, x, y + radius * 0.02);
  }
  if (ball.frost) {
    ctx.strokeStyle = "rgba(210, 244, 255, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.78, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
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
  ctx.fillStyle = particle.color;
  ctx.globalAlpha = alpha * 0.28;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size * 2.3, 0, Math.PI * 2);
  ctx.fill();
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
  ctx.globalAlpha = (1 - ring.t) * 0.75;
  ctx.strokeStyle = ring.color;
  ctx.lineWidth = ring.massive ? 6 : 3;
  ctx.beginPath();
  ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = (1 - ring.t) * 0.28;
  ctx.lineWidth = ring.massive ? 16 : 9;
  ctx.beginPath();
  ctx.arc(ring.x, ring.y, ring.r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawFloat(ctx: CanvasRenderingContext2D, float: ViewState["floats"][number]): void {
  const alpha = Math.max(0, float.life / float.max);
  const age = 1 - alpha;
  let scale = 1;
  if (age < 0.14) scale = 0.32 + (age / 0.14) * 1.08;
  else if (age < 0.3) scale = 1.4 - ((age - 0.14) / 0.16) * 0.4;
  scale *= float.pop;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(float.x, float.y);
  ctx.scale(scale, scale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '700 40px "JetBrains Mono", monospace';
  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(6, 10, 20, 0.38)";
  ctx.strokeText(float.text, 0, 0);
  ctx.shadowColor = float.color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(float.text, 0, 0);
  ctx.shadowBlur = 0;
  ctx.font = "600 14px Vazirmatn, sans-serif";
  ctx.fillStyle = float.color;
  ctx.fillText(float.sub, 0, 28);
  ctx.restore();
}

function drawBanner(ctx: CanvasRenderingContext2D, view: ViewState): void {
  const intro = Math.min(1, (1.2 - view.bannerLife) / 0.16);
  const scale = 0.7 + intro * 0.38;
  ctx.save();
  ctx.globalAlpha = Math.min(1, view.bannerLife);
  ctx.translate(view.width / 2, view.height * 0.34);
  ctx.scale(scale, scale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 34px Vazirmatn, sans-serif";
  ctx.shadowColor = "rgba(255, 210, 120, 0.85)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#fff6d4";
  ctx.fillText(view.banner, 0, 0);
  ctx.restore();
}

function armedColor(id: string): string {
  if (id === "frost") return "#8fd4ea";
  if (id === "void") return "#d5deee";
  if (id === "magnet") return "#e3a4ff";
  if (id === "spark") return "#ffe56a";
  return "#b6e36a";
}

function signColor(base: string): string {
  return mixHex(base, "#243044", 0.36);
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
