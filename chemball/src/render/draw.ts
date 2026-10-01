import type { ViewBall, ViewState } from "../game/view";

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
  for (const particle of view.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.max);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (view.shot) drawBall(ctx, view.shot);
  drawLauncher(ctx, view);
  if (view.current) drawBall(ctx, view.current);
  if (view.next) {
    drawBall(ctx, view.next);
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = "#d5e4ff";
    ctx.font = "600 11px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(view.nextLabel, view.next.x, view.next.y - view.next.r * view.next.scale - 8);
    ctx.globalAlpha = 1;
  }
  for (const float of view.floats) drawFloat(ctx, float);
  if (view.banner && view.bannerLife > 0) {
    ctx.globalAlpha = Math.min(1, view.bannerLife);
    ctx.fillStyle = "#ffe7a3";
    ctx.font = "700 28px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(view.banner, view.width / 2, view.height * 0.4);
    ctx.globalAlpha = 1;
  }
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
    g.strokeStyle = "rgba(180, 210, 255, 0.05)";
    g.lineWidth = 2;
    for (let i = 0; i < 7; i += 1) {
      const x = width * (0.08 + i * 0.14);
      const y = height * (0.18 + (i % 3) * 0.16);
      crystal(g, x, y, 18 + (i % 4) * 8, i);
    }
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

function crystal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, seed: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(seed);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.55, -size * 0.2);
  ctx.lineTo(size * 0.25, size * 0.85);
  ctx.lineTo(-size * 0.4, size * 0.45);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
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
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i]!;
    ctx.globalAlpha = 0.12 + (i / points.length) * 0.4;
    ctx.fillStyle = "#e7f4ff";
    ctx.beginPath();
    ctx.arc(point.x, point.y, i === points.length - 1 ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawGhost(ctx: CanvasRenderingContext2D, view: ViewState): void {
  if (!view.ghost) return;
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1.5;
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

function drawBall(ctx: CanvasRenderingContext2D, ball: ViewBall): void {
  const radius = ball.r * ball.scale;
  if (radius < 2 || ball.alpha <= 0.02) return;
  const { x, y, style } = ball;
  const tint = style.tint ?? "#e7e2d8";
  const ink = "#1a1c22";
  ctx.save();
  ctx.globalAlpha = ball.alpha;

  ctx.fillStyle = "rgba(8, 10, 16, 0.28)";
  ctx.beginPath();
  ctx.ellipse(x + radius * 0.06, y + radius * 0.92, radius * 0.58, radius * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  const wash = ctx.createRadialGradient(x, y, radius * 0.86, x, y, radius * 1.08);
  wash.addColorStop(0, withAlpha(tint, 0.0));
  wash.addColorStop(1, withAlpha(tint, ball.charge ? 0.22 : 0.1));
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.08, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(
    x - radius * 0.32,
    y - radius * 0.38,
    radius * 0.05,
    x + radius * 0.04,
    y + radius * 0.12,
    radius,
  );
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.22, "#fbf9f5");
  body.addColorStop(0.62, "#f3efe8");
  body.addColorStop(0.86, mixToward(tint, 246, 0.72));
  body.addColorStop(1, mixToward(tint, 90, 0.18));
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  const shade = ctx.createRadialGradient(x, y + radius * 0.55, radius * 0.08, x, y, radius);
  shade.addColorStop(0, withAlpha(tint, 0.28));
  shade.addColorStop(0.55, "rgba(40, 36, 28, 0.05)");
  shade.addColorStop(1, "rgba(40, 36, 28, 0)");
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.96, 0, Math.PI * 2);
  ctx.fill();

  const marked = chargeMark(ball.glyph, ball.charge);
  paintSymbol(ctx, marked, x, y + radius * 0.02, radius, ink);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.ellipse(x - radius * 0.28, y - radius * 0.34, radius * 0.16, radius * 0.07, -0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, radius * 0.9, Math.PI * 1.15, Math.PI * 1.75);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = Math.max(1, radius * 0.035);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, radius - 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(40, 36, 30, 0.18)";
  ctx.lineWidth = Math.max(1, radius * 0.03);
  ctx.stroke();

  if (ball.charge) {
    ctx.strokeStyle = ball.charge > 0 ? "rgba(70, 110, 160, 0.35)" : "rgba(90, 130, 80, 0.35)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.78, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (ball.frost) {
    ctx.strokeStyle = "rgba(190, 214, 224, 0.9)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.82, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  ctx.restore();
}

function chargeMark(glyph: string, charge: -1 | 0 | 1): string {
  if (charge > 0) return `${glyph}⁺`;
  if (charge < 0) return `${glyph}⁻`;
  return glyph;
}

function paintSymbol(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  if (!text) return;
  const runs = markRuns(text);
  const bases = runs.filter((run) => run.role === "base").length;
  const size = radius * (bases <= 1 ? 0.8 : bases === 2 ? 0.58 : bases === 3 ? 0.46 : 0.38);
  const subSize = size * 0.58;
  ctx.save();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const widths = runs.map((run) => {
    ctx.font = `650 ${run.role === "base" ? size : subSize}px "IBM Plex Sans", Manrope, sans-serif`;
    return ctx.measureText(run.text).width;
  });
  const total = widths.reduce((sum, width) => sum + width, 0);
  let cursor = x - total / 2;
  runs.forEach((run, index) => {
    const width = widths[index] ?? 0;
    const dy = run.role === "sub" ? size * 0.28 : run.role === "sup" ? -size * 0.32 : 0;
    ctx.font = `650 ${run.role === "base" ? size : subSize}px "IBM Plex Sans", Manrope, sans-serif`;
    ctx.fillText(run.text, cursor, y + dy);
    cursor += width;
  });
  ctx.restore();
}

function markRuns(text: string): Array<{ text: string; role: "base" | "sub" | "sup" }> {
  const subs: Record<string, string> = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9" };
  return [...text].map((char) => {
    if (subs[char]) return { text: subs[char], role: "sub" as const };
    if (char === "⁺" || char === "+") return { text: "+", role: "sup" as const };
    if (char === "⁻" || char === "−") return { text: "−", role: "sup" as const };
    return { text: char, role: "base" as const };
  });
}


function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((part) => part + part).join("") : raw.padEnd(6, "0").slice(0, 6);
  return [
    Number.parseInt(full.slice(0, 2), 16) || 0,
    Number.parseInt(full.slice(2, 4), 16) || 0,
    Number.parseInt(full.slice(4, 6), 16) || 0,
  ];
}


function mixToward(hex: string, toward: number, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value + (toward - value) * amount)));
  return `#${[channel(r), channel(g), channel(b)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

function drawRing(ctx: CanvasRenderingContext2D, ring: { x: number; y: number; r: number; t: number; massive: boolean }): void {
  ctx.save();
  ctx.globalAlpha = (1 - ring.t) * 0.8;
  ctx.strokeStyle = ring.massive ? "rgba(255, 190, 120, 0.95)" : "rgba(255, 230, 190, 0.9)";
  ctx.lineWidth = ring.massive ? 6 : 3;
  ctx.beginPath();
  ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawFloat(ctx: CanvasRenderingContext2D, float: ViewState["floats"][number]): void {
  const alpha = Math.max(0, float.life / float.max);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `650 26px "IBM Plex Sans", Manrope, sans-serif`;
  const titleWidth = ctx.measureText(float.text).width;
  ctx.font = `500 12px "IBM Plex Sans", Manrope, sans-serif`;
  const subWidth = ctx.measureText(float.sub).width;
  const width = Math.max(titleWidth, subWidth) + 28;
  const height = 54;
  ctx.fillStyle = "rgba(247, 244, 238, 0.94)";
  roundRect(ctx, float.x - width / 2, float.y - height / 2, width, height, 16);
  ctx.fill();
  ctx.fillStyle = "#1a1c22";
  ctx.font = `650 26px "IBM Plex Sans", Manrope, sans-serif`;
  ctx.fillText(float.text, float.x, float.y - 8);
  ctx.globalAlpha = alpha * 0.62;
  ctx.font = `500 11px "IBM Plex Sans", Manrope, sans-serif`;
  ctx.fillText(float.sub, float.x, float.y + 14);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
