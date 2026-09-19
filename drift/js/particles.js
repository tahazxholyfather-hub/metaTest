import { CANVAS_W, CANVAS_H, randRange, pick } from './utils.js';

const POOL = 800;

export class ParticleSystem {
  constructor() {
    this.pool = [];
    for (let i = 0; i < POOL; i++) {
      this.pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff', kind: 'dot' });
    }
    this.ambient = [];
  }

  spawn(x, y, opts = {}) {
    const p = this.pool.find((q) => !q.active);
    if (!p) return;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = opts.vx ?? 0;
    p.vy = opts.vy ?? 0;
    p.life = opts.life ?? 1;
    p.max = p.life;
    p.size = opts.size ?? 3;
    p.color = opts.color ?? '#ffffff';
    p.kind = opts.kind ?? 'dot';
    p.gravity = opts.gravity ?? 0;
    p.fade = opts.fade ?? true;
  }

  burst(x, y, n, opts) {
    for (let i = 0; i < n; i++) this.spawn(x, y, opts);
  }

  setAmbient(kind, density, cameraX, biomePalette) {
    this.ambientKind = kind;
    this.ambientDensity = density;
    this.ambientColor = biomePalette?.[2] ?? '#aaa';
    this._camX = cameraX;
  }

  update(dt, cameraX, cameraY) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity || 0) * dt;
    }

    const target = Math.floor(this.ambientDensity * 120);
    while (this.ambient.length < target) {
      this.ambient.push(this._makeAmbient(cameraX, cameraY));
    }
    while (this.ambient.length > target) this.ambient.pop();
    for (const a of this.ambient) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.x < cameraX - 100) a.x = cameraX + CANVAS_W + 100;
      if (a.x > cameraX + CANVAS_W + 100) a.x = cameraX - 100;
    }
  }

  _makeAmbient(camX, camY) {
    const kind = this.ambientKind || 'dust';
    const x = camX + Math.random() * (CANVAS_W + 200) - 100;
    const y = camY + Math.random() * CANVAS_H;
    if (kind === 'rain') {
      return { x, y: camY - 20, vx: -80, vy: 420, len: 12, color: 'rgba(180,200,220,0.5)' };
    }
    if (kind === 'snow') {
      return { x, y, vx: Math.random() * 40 - 20, vy: 30 + Math.random() * 50, size: 1 + Math.random() * 2, color: 'rgba(255,255,255,0.8)' };
    }
    if (kind === 'leaves') {
      return { x, y, vx: -30 + Math.random() * 20, vy: 20 + Math.random() * 30, size: 4, color: this.ambientColor, rot: Math.random() * 6 };
    }
    return { x, y, vx: Math.random() * 30 - 15, vy: Math.random() * 10 - 5, size: 2, color: 'rgba(255,255,255,0.15)' };
  }

  draw(ctx, cameraX) {
    for (const a of this.ambient) {
      ctx.save();
      if (a.len) {
        ctx.strokeStyle = a.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + a.vx * 0.04, a.y + a.len);
        ctx.stroke();
      } else {
        ctx.fillStyle = a.color;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.size || 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const p of this.pool) {
      if (!p.active) continue;
      const t = p.life / p.max;
      ctx.globalAlpha = p.fade ? t : 1;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
