import {
  CharacterEngine,
  drawCharacter,
  BODY_COLOR,
  EYE_COLOR,
} from './character.js';
import { PLAYER_RADIUS, GROUND_Y, clamp, meters } from './utils.js';
import { surfaceFriction } from './biomes.js';

const TEX = 128;
const VIEW = 200;

const BASE_SPEED = 165;
const MAX_SPEED = 290;
const GRAVITY = 1950;
const JUMP_V = 640;
const JUMP_CUT = 0.48;
const COYOTE = 0.1;
const BUFFER = 0.14;
const MAX_FALL = 980;
const FRICTION = 2100;

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = BASE_SPEED;
    this.vy = 0;
    this.radius = PLAYER_RADIUS;
    this.grounded = false;
    this.dead = false;
    this.deathFade = 0;
    this.coyote = 0;
    this.buffer = 0;
    this.jumpHeld = false;
    this.squashX = 1;
    this.squashY = 1;
    this.roll = 0;
    this.prevVy = 0;
    this.landLock = 0;
    this.windForce = 0;
    this.inDark = false;
    this.gliding = false;
    this.path = 'main';
    this.autoRun = true;
    this.atRest = false;
    this.restPoint = null;
    this.checkpoint = { x: x, y: y, distM: 0 };
    this.engine = new CharacterEngine();
    this.engine.settle(0.8);
    this.currentState = 'idle';
    this.look = { x: 0.3, y: 0 };
    this.trail = [];
    this.ropePhase = 'idle';
    this.ropeAnchor = null;
    this.hookActive = false;
    this.hookTarget = null;
    this._canvas = document.createElement('canvas');
    this._canvas.width = TEX;
    this._canvas.height = TEX;
    this._ctx = this._canvas.getContext('2d');
  }

  resetToCheckpoint() {
    this.x = this.checkpoint.x;
    this.y = this.checkpoint.y;
    this.vx = BASE_SPEED;
    this.vy = 0;
    this.dead = false;
    this.deathFade = 0;
    this.atRest = false;
    this.engine.setState('surprised');
    this.engine.blink();
  }

  setCheckpoint(x, y, distM) {
    this.checkpoint = { x, y, distM };
    this.restPoint = { x, y, distM };
  }

  startRope(anchor) {
    this.ropeAnchor = anchor;
    this.ropePhase = 'swing';
    this.vy = 0;
  }

  startHook(target) {
    this.hookTarget = target;
    this.hookActive = true;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deathFade = 0;
    this.engine.setState('sad');
  }

  update(dt, input, world, tools, audio, camera) {
    if (this.atRest) {
      this.vx = 0;
      this.vy = 0;
      this.engine.setState('idle');
      this.engine.update(dt);
      return;
    }

    if (this.dead) {
      this.deathFade += dt;
      this.engine.update(dt);
      return;
    }

    this.inDark = false;
    this.windForce *= 0.9;

    const gy = world.groundYAt(this.x, this.path);
    const surface = world.surfaceAt(this.x);
    const fricMul = surfaceFriction(surface);

    if (this.hookActive && this.hookTarget) {
      const dx = this.hookTarget.x - this.x;
      const dy = this.hookTarget.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 20) {
        this.hookActive = false;
        this.hookTarget = null;
      } else {
        const spd = 520;
        this.vx = (dx / dist) * spd;
        this.vy = (dy / dist) * spd;
      }
    } else if (this.ropePhase === 'swing' && this.ropeAnchor) {
      const ax = this.ropeAnchor.x;
      const ay = this.ropeAnchor.y;
      const len = Math.hypot(this.x - ax, this.y - ay);
      if (len > 200 || this.grounded) {
        this.ropePhase = 'idle';
        this.ropeAnchor = null;
        this.vx = BASE_SPEED + 80;
      } else {
        this.vy += GRAVITY * dt * 0.6;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        const pull = 800;
        this.vx += ((ax - this.x) / len) * pull * dt;
        this.vy += ((ay - this.y) / len) * pull * dt;
      }
    } else {
      if (this.autoRun) {
        this.vx += (BASE_SPEED - this.vx) * Math.min(1, dt * 2);
      }

      if (input.axis !== 0) {
        this.vx += input.axis * 400 * dt;
        this.vx = clamp(this.vx, 40, MAX_SPEED);
      }

      this.vx += this.windForce * dt;
      this.vy += GRAVITY * dt;
      if (this.gliding && this.vy > 0) {
        this.vy = Math.min(this.vy, 120);
        this.vx += 40 * dt;
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      if (gy != null) {
        const floor = gy - this.radius;
        if (this.y >= floor) {
          const landed = !this.grounded && this.prevVy > 220;
          this.y = floor;
          this.vy = 0;
          this.grounded = true;
          this.coyote = COYOTE;
          if (landed) {
            const impact = clamp(this.prevVy / 800, 0, 1);
            this.squashX = 1 + 0.35 * impact;
            this.squashY = 1 - 0.3 * impact;
            audio?.playSfx('land');
            if (impact > 0.4) camera?.shakeScreen(4 + impact * 4);
            this.engine.play({
              duration: 0.28,
              keys: [
                { at: 0, pose: { height: 0.78, width: 1.18, shiftEl: -0.02 } },
                { at: 0.12, pose: {} },
              ],
            });
          }
          const drag = FRICTION * fricMul;
          if (input.axis === 0 && !this.autoRun) {
            const nv =
              this.vx > 0
                ? Math.max(BASE_SPEED, this.vx - drag * dt)
                : Math.min(BASE_SPEED, this.vx + drag * dt);
            this.vx = nv;
          }
        } else {
          this.grounded = false;
          this.coyote = Math.max(0, this.coyote - dt);
        }
      } else {
        this.grounded = false;
        this.coyote = Math.max(0, this.coyote - dt);
      }

      for (const [, ch] of world.chunks) {
        for (const pl of ch.platforms) {
          if (pl.broken) continue;
          if (
            this.x > pl.x &&
            this.x < pl.x + pl.w &&
            this.y + this.radius >= pl.y &&
            this.y + this.radius <= pl.y + 20 &&
            this.vy >= 0
          ) {
            this.y = pl.y - this.radius;
            this.vy = 0;
            this.grounded = true;
            if (pl.kind === 'moving') {
              this.y += Math.sin(pl.phase) * 2;
            }
          }
        }
      }

      if (input.jumpPressed) this.buffer = BUFFER;
      else this.buffer = Math.max(0, this.buffer - dt);

      const canJump =
        this.coyote > 0 && this.buffer > 0 && this.landLock <= 0 && this.ropePhase === 'idle';
      if (canJump) {
        this.vy = -JUMP_V;
        this.coyote = 0;
        this.buffer = 0;
        this.jumpHeld = true;
        this.squashX = 0.78;
        this.squashY = 1.28;
        audio?.playSfx('jump');
        this.engine.setState('curious');
      }
      if (!input.jump) {
        if (this.jumpHeld && this.vy < 0) this.vy *= JUMP_CUT;
        this.jumpHeld = false;
      }

      if (this.vy > MAX_FALL) this.vy = MAX_FALL;
    }

    this.landLock = Math.max(0, this.landLock - dt);
    this.prevVy = this.vy;

    this.squashX += (1 - this.squashX) * Math.min(1, dt * 12);
    this.squashY += (1 - this.squashY) * Math.min(1, dt * 12);

    this.roll += (this.vx / this.radius) * dt;

    const spd = Math.hypot(this.vx, this.vy);
    this.look.x += (clamp(this.vx / 280, -1, 1) - this.look.x) * Math.min(1, dt * 6);
    this.look.y += (clamp(this.vy / 400, -1, 1) - this.look.y) * Math.min(1, dt * 6);
    this.engine.setLookAt({ x: this.look.x, y: this.look.y });

    if (!this.grounded) {
      this.engine.setState(this.vy < -40 ? 'curious' : this.vy > 420 ? 'shocked' : 'surprised');
    } else if (spd > 210) this.engine.setState('excited');
    else if (spd > 50) this.engine.setState('curious');
    else this.engine.setState('idle');

    this.engine.update(dt);

    if (spd > 180) {
      this.trail.push({ x: this.x, y: this.y, a: 0.35 });
      if (this.trail.length > 8) this.trail.shift();
    }
    for (const t of this.trail) t.a -= dt * 2;
    this.trail = this.trail.filter((t) => t.a > 0);
  }

  draw(ctx, tools) {
    for (const t of this.trail) {
      ctx.fillStyle = `rgba(245,241,234,${t.a * 0.4})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.radius * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }

    drawCharacter(this._ctx, this.engine, {
      destSize: TEX,
      color: BODY_COLOR,
      eyeColor: EYE_COLOR,
    });

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.roll);
    ctx.scale(this.squashX, this.squashY);
    const scale = (this.radius * 2) / TEX;
    ctx.scale(scale, scale);
    ctx.drawImage(this._canvas, -TEX / 2, -TEX / 2);

    if (this.gliding) {
      ctx.strokeStyle = 'rgba(200,220,240,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.quadraticCurveTo(0, -25, 25, 5);
      ctx.stroke();
    }

    if (this.ropeAnchor && this.ropePhase === 'swing') {
      ctx.strokeStyle = '#8a7040';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(this.ropeAnchor.x - this.x, this.ropeAnchor.y - this.y);
      ctx.stroke();
    }

    if (this.hookActive && this.hookTarget) {
      ctx.strokeStyle = '#aaa';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(this.hookTarget.x - this.x, this.hookTarget.y - this.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

    if (this.dead) {
      ctx.fillStyle = `rgba(0,0,0,${clamp(this.deathFade * 0.8, 0, 0.85)})`;
      ctx.fillRect(this.x - 40, this.y - 40, 80, 80);
    }
  }

  drawLight(ctx, tools) {
    if (!tools.lightActive()) return;
    const r = tools.lightRadius();
    const g = ctx.createRadialGradient(this.x, this.y, 10, this.x, this.y, r);
    g.addColorStop(0, 'rgba(255,240,180,0.35)');
    g.addColorStop(0.5, 'rgba(255,220,120,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(this.x - r, this.y - r, r * 2, r * 2);
  }
}
