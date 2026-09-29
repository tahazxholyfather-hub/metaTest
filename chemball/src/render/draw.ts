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
  const ink = markInk(style.base);
  ctx.save();
  ctx.globalAlpha = ball.alpha;

  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(x + radius * 0.08, y + radius * 0.96, radius * 0.62, radius * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  const bloom = ctx.createRadialGradient(x, y, radius * 0.82, x, y, radius * 1.22);
  bloom.addColorStop(0, withAlpha(style.base, 0.28));
  bloom.addColorStop(1, withAlpha(style.base, 0));
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.22, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(
    x - radius * 0.36,
    y - radius * 0.42,
    radius * 0.04,
    x + radius * 0.08,
    y + radius * 0.16,
    radius * 1.08,
  );
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.1, lighten(style.glow, 0.55));
  body.addColorStop(0.28, style.glow);
  body.addColorStop(0.58, style.base);
  body.addColorStop(0.82, style.rim);
  body.addColorStop(1, darken(style.rim, 0.5));
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  const shade = ctx.createRadialGradient(x, y + radius * 0.72, radius * 0.05, x, y + radius * 0.15, radius * 1.05);
  shade.addColorStop(0, "rgba(0,0,0,0.38)");
  shade.addColorStop(0.45, "rgba(0,0,0,0.12)");
  shade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  if (ball.kind === "material") drawIcon(ctx, ball.icon, x, y + radius * 0.04, radius, ink);
  else paintSymbol(ctx, ball.glyph, x, y + radius * 0.03, radius, ink);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.ellipse(x - radius * 0.3, y - radius * 0.36, radius * 0.2, radius * 0.09, -0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.ellipse(x + radius * 0.22, y + radius * 0.28, radius * 0.1, radius * 0.05, 0.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, radius * 0.9, Math.PI * 1.05, Math.PI * 1.85);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(1, radius * 0.045);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, radius - 0.6, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = Math.max(1, radius * 0.035);
  ctx.stroke();

  if (ball.frost) {
    ctx.strokeStyle = "rgba(236, 250, 255, 0.9)";
    ctx.lineWidth = Math.max(1.2, radius * 0.055);
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.84, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  ctx.restore();
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
  const letters = [...text].length;
  const size = radius * (letters > 1 ? 0.58 : 0.84);
  ctx.save();
  ctx.font = `700 ${size}px Outfit, Vazirmatn, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = letters > 1 ? `${-size * 0.05}px` : "0px";
  ctx.shadowColor = color === DARK_INK ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.4)";
  ctx.shadowBlur = radius * 0.14;
  ctx.shadowOffsetY = radius * 0.03;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawIcon(
  ctx: CanvasRenderingContext2D,
  icon: string,
  x: number,
  y: number,
  radius: number,
  ink: string,
): void {
  const cut = ink === DARK_INK ? "#fffdf6" : "#16141a";
  ctx.save();
  ctx.translate(x, y);
  const unit = radius * 0.5;
  ctx.scale(unit, unit);
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 0.22;
  if (icon === "water" || icon === "charged") {
    drop(ctx);
    ctx.fill();
    if (icon === "charged") {
      ctx.fillStyle = cut;
      bolt(ctx, 0.62);
      ctx.fill();
    }
  } else if (icon === "fire") {
    flame(ctx);
    ctx.fill();
    ctx.fillStyle = cut;
    ctx.save();
    ctx.translate(0, 0.18);
    ctx.scale(0.42, 0.42);
    flame(ctx);
    ctx.fill();
    ctx.restore();
  } else if (icon === "steam") {
    ctx.lineWidth = 0.26;
    for (const col of [-0.52, 0, 0.52]) {
      ctx.beginPath();
      ctx.moveTo(col, 0.82);
      ctx.bezierCurveTo(col - 0.38, 0.28, col + 0.38, -0.22, col, -0.86);
      ctx.stroke();
    }
  } else if (icon === "smoke") {
    ctx.beginPath();
    ctx.arc(-0.38, 0.22, 0.4, 0, Math.PI * 2);
    ctx.arc(0.12, -0.16, 0.48, 0, Math.PI * 2);
    ctx.arc(0.5, 0.3, 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (icon === "acid") {
    ctx.beginPath();
    ctx.moveTo(-0.62, -0.92);
    ctx.lineTo(0.62, -0.92);
    ctx.lineTo(0.24, 0.02);
    ctx.lineTo(0.5, 0.88);
    ctx.quadraticCurveTo(0, 1.05, -0.5, 0.88);
    ctx.lineTo(-0.24, 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = cut;
    ctx.beginPath();
    ctx.arc(0.02, 0.42, 0.14, 0, Math.PI * 2);
    ctx.fill();
  } else if (icon === "corrosion") {
    ctx.beginPath();
    ctx.arc(0, 0.05, 0.78, 0, Math.PI * 2);
    ctx.moveTo(0.55, -0.15);
    ctx.arc(0.42, -0.12, 0.38, 0, Math.PI * 2);
    ctx.fill("evenodd");
  } else if (icon === "explosive") {
    spike(ctx, 1.05, 8);
    ctx.fill();
    ctx.fillStyle = cut;
    ctx.beginPath();
    ctx.arc(0, 0, 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (icon === "ice") {
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 3;
      const cx = Math.cos(angle);
      const cy = Math.sin(angle);
      ctx.moveTo(0, 0);
      ctx.lineTo(cx * 0.95, cy * 0.95);
      const bx = cx * 0.55;
      const by = cy * 0.55;
      const px = -cy;
      const py = cx;
      ctx.moveTo(bx + px * 0.22, by + py * 0.22);
      ctx.lineTo(bx - px * 0.22, by - py * 0.22);
    }
    ctx.stroke();
  } else if (icon === "crystal") {
    ctx.beginPath();
    ctx.moveTo(0, -1.02);
    ctx.lineTo(0.72, -0.08);
    ctx.lineTo(0, 1.02);
    ctx.lineTo(-0.72, -0.08);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = cut;
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.moveTo(0, -1.02);
    ctx.lineTo(0, 1.02);
    ctx.moveTo(-0.72, -0.08);
    ctx.lineTo(0.72, -0.08);
    ctx.stroke();
  } else if (icon === "energy") {
    bolt(ctx, 1);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drop(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(0, -1.08);
  ctx.bezierCurveTo(0.95, -0.15, 0.78, 0.95, 0, 0.98);
  ctx.bezierCurveTo(-0.78, 0.95, -0.95, -0.15, 0, -1.08);
}

function flame(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(0, -1.12);
  ctx.bezierCurveTo(0.72, -0.45, 0.95, 0.05, 0.55, 0.72);
  ctx.quadraticCurveTo(0.28, 0.28, 0.08, 0.48);
  ctx.quadraticCurveTo(-0.12, 0.18, -0.42, 0.78);
  ctx.bezierCurveTo(-1.05, 0.15, -0.78, -0.55, 0, -1.12);
}

function bolt(ctx: CanvasRenderingContext2D, scale: number): void {
  ctx.beginPath();
  ctx.moveTo(0.18 * scale, -0.95 * scale);
  ctx.lineTo(-0.42 * scale, 0.05 * scale);
  ctx.lineTo(0.02 * scale, 0.05 * scale);
  ctx.lineTo(-0.16 * scale, 0.95 * scale);
  ctx.lineTo(0.52 * scale, -0.12 * scale);
  ctx.lineTo(0.05 * scale, -0.12 * scale);
  ctx.closePath();
}

const DARK_INK = "#16141c";

function markInk(base: string): string {
  return luminance(base) > 0.52 ? DARK_INK : "#f7f8ff";
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
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

function lighten(hex: string, amount: number): string {
  return mixToward(hex, 255, amount);
}

function darken(hex: string, amount: number): string {
  return mixToward(hex, 0, amount);
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

function spike(ctx: CanvasRenderingContext2D, radius: number, points: number): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const dist = i % 2 === 0 ? radius : radius * 0.45;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
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
  ctx.fillStyle = float.color;
  ctx.font = "700 18px Outfit, sans-serif";
  ctx.fillText(float.text, float.x, float.y);
  ctx.globalAlpha = alpha * 0.85;
  ctx.font = "600 11px Outfit, sans-serif";
  ctx.fillText(float.sub, float.x, float.y + 16);
  ctx.restore();
}
