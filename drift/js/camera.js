import { CANVAS_W, CANVAS_H, easeOutCubic, easeInOutCubic, clamp, lerp } from './utils.js';

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.targetZoom = 1;
    this.shake = 0;
    this.shakeMag = 0;
    this.lead = 80;
    this.panLock = 0;
    this.panTarget = null;
  }

  shakeScreen(mag, dur = 0.12) {
    this.shakeMag = mag;
    this.shake = dur;
  }

  startPan(worldX, dur = 1.5) {
    this.panLock = dur;
    this.panTarget = worldX;
  }

  update(dt, player, ctx = 'normal') {
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);

    let lead = this.lead;
    let tz = 1;
    if (ctx === 'narrow') {
      tz = 1.12;
      lead = 40;
    } else if (ctx === 'fall') {
      lead = 50;
    } else if (ctx === 'fast') {
      lead = 120;
      tz = 0.94;
    } else if (ctx === 'rest') {
      tz = 1.08;
      lead = 20;
    } else if (ctx === 'death') {
      tz = 0.88;
    } else if (ctx === 'vista') {
      tz = 0.82;
    }

    this.targetZoom = tz;
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 2.5);

    let targetX = player.x + lead - CANVAS_W * 0.35;
    if (this.panLock > 0 && this.panTarget != null) {
      this.panLock -= dt;
      targetX = lerp(targetX, this.panTarget - CANVAS_W * 0.5, easeInOutCubic(clamp(1 - this.panLock / 1.5, 0, 1)));
    }

    const targetY = player.y - CANVAS_H * 0.55;
    const smooth = ctx === 'fall' ? 4 : 8;
    this.x += (targetX - this.x) * Math.min(1, dt * smooth);
    this.y += (targetY - this.y) * Math.min(1, dt * 6);

    if (player.dead) {
      this.zoom += (0.85 - this.zoom) * Math.min(1, dt * 1.2);
    }
  }

  apply(ctx) {
    const zx = CANVAS_W / 2;
    const zy = CANVAS_H / 2;
    ctx.save();
    ctx.translate(zx, zy);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-zx, -zy);

    let sx = 0;
    let sy = 0;
    if (this.shake > 0) {
      const m = this.shakeMag * (this.shake / 0.12);
      sx = (Math.random() - 0.5) * m;
      sy = (Math.random() - 0.5) * m;
    }
    ctx.translate(-this.x + sx, -this.y + sy);
  }

  release(ctx) {
    ctx.restore();
  }

  worldToScreen(wx, wy) {
    const zx = CANVAS_W / 2;
    const zy = CANVAS_H / 2;
    const sx = (wx - this.x) * this.zoom + zx * (1 - this.zoom);
    const sy = (wy - this.y) * this.zoom + zy * (1 - this.zoom);
    return { x: sx, y: sy };
  }
}
