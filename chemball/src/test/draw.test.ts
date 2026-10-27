import { describe, expect, it } from "vitest";
import { formulaCacheSize } from "../render/chem";
import { renderFrame } from "../render/draw";
import type { ViewBall, ViewState } from "../game/view";

describe("playfield rendering", () => {
  it("draws flat balls and the theme aim color without gradients or glow", () => {
    const stats = { radial: 0, linear: 0, shadow: 0, strokes: [] as string[] };
    const ctx = mockContext(stats);
    renderFrame(ctx, view(), 1);
    expect(stats.radial).toBe(0);
    expect(stats.linear).toBe(0);
    expect(stats.shadow).toBe(0);
    expect(stats.strokes).toContain("#8fd4ff");
    expect(stats.strokes).toContain("#8b7bff");
    const warmed = formulaCacheSize();
    const started = performance.now();
    for (let frame = 0; frame < 40; frame += 1) renderFrame(ctx, view(), 1);
    expect(performance.now() - started).toBeLessThan(250);
    expect(formulaCacheSize()).toBe(warmed);
  });
});

function view(): ViewState {
  const ball: ViewBall = {
    x: 120,
    y: 180,
    r: 24,
    scale: 1,
    alpha: 1,
    kind: "element",
    icon: "",
    glyph: "H",
    formula: "Hydrogen",
    style: { base: "#8fd4ff", glow: "#e7f7ff", rim: "#3d8ec4", ink: "#083044" },
    frost: false,
  };
  return {
    width: 390,
    height: 844,
    balls: [ball],
    shot: null,
    trajectory: [{ x: 195, y: 700 }, { x: 195, y: 640 }, { x: 190, y: 580 }],
    ghost: { x: 190, y: 560 },
    particles: [],
    floats: [],
    dangerY: 640,
    launcherX: 195,
    launcherY: 760,
    aimAngle: -Math.PI / 2,
    current: ball,
    next: null,
    shake: 0,
    flash: 0,
    splash: [],
    bolts: [],
    ring: null,
    banner: "",
    bannerLife: 0,
    armed: "",
    chill: 0,
  };
}

function mockContext(stats: { radial: number; linear: number; shadow: number; strokes: string[] }): CanvasRenderingContext2D {
  const gradient = { addColorStop() {} };
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    shadowBlur: 0,
    shadowColor: "",
    set shadowBlurSet(value: number) {
      stats.shadow += value;
    },
    setTransform() {},
    fillRect() {},
    clearRect() {},
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    ellipse() {},
    fill() {},
    stroke() {},
    fillText() {},
    strokeText() {},
    clip() {},
    translate() {},
    rotate() {},
    scale() {},
    setLineDash() {},
    drawImage() {},
    measureText() {
      return { width: 12 };
    },
    createRadialGradient() {
      stats.radial += 1;
      return gradient;
    },
    createLinearGradient() {
      stats.linear += 1;
      return gradient;
    },
  };
  return new Proxy(ctx, {
    set(target, key, value) {
      if (key === "strokeStyle" && typeof value === "string") stats.strokes.push(value);
      if (key === "shadowBlur" && typeof value === "number" && value > 0) stats.shadow += value;
      Reflect.set(target, key, value);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}
