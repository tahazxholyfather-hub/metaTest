import {
  CHUNK_MAX,
  CHUNK_MIN,
  GROUND_Y,
  createRng,
  randRange,
  randInt,
  pick,
  meters,
  pixelsFromMeters,
  PLAYER_RADIUS,
} from './utils.js';
import { biomeAtDistance, surfaceFriction } from './biomes.js';

const HAZARD_TYPES = ['gap', 'moving', 'crumble', 'narrow', 'rocks', 'water', 'wind', 'ice', 'dark', 'longGap', 'wait'];

export class World {
  constructor(seed = 42) {
    this.seed = seed;
    this.chunks = new Map();
    this.restPoints = [];
    this.branchZones = [];
    this.nextRestM = 1800;
    this.nextBranchM = 2000;
    this.landmarks = [];
  }

  chunkKey(cx) {
    return Math.floor(cx);
  }

  getChunk(cx) {
    const key = this.chunkKey(cx);
    if (!this.chunks.has(key)) {
      this.chunks.set(key, this._generateChunk(key));
    }
    return this.chunks.get(key);
  }

  _generateChunk(key) {
    const rng = createRng(this.seed + key * 9973);
    const width = randInt(rng, CHUNK_MIN, CHUNK_MAX);
    const startX = key * ((CHUNK_MIN + CHUNK_MAX) / 2);
    const distM = meters(startX);
    const biome = biomeAtDistance(distM);
    const surface = biome.current.surface;

    const ground = [];
    let x = startX;
    const segments = randInt(rng, 3, 6);
    let gy = GROUND_Y + randRange(rng, -40, 40);
    for (let i = 0; i < segments; i++) {
      const w = width / segments;
      const nextGy = GROUND_Y + randRange(rng, -80, 60);
      ground.push({ x, w, y: gy, surface: pick(rng, [surface, 'wood', 'stone']) });
      gy = nextGy;
      x += w;
    }

    const platforms = [];
    const hazards = [];
    const pickups = [];
    const anchors = [];

    const hazardCount = randInt(rng, 1, 3);
    for (let h = 0; h < hazardCount; h++) {
      const hx = startX + randRange(rng, 80, width - 80);
      const ht = pick(rng, HAZARD_TYPES);
      hazards.push(this._makeHazard(ht, hx, rng, distM));
    }

    const platCount = randInt(rng, 2, 4);
    for (let p = 0; p < platCount; p++) {
      const px = startX + randRange(rng, 100, width - 100);
      const py = GROUND_Y - randRange(rng, 60, 180);
      const pw = randRange(rng, 80, 200);
      const kind = rng() > 0.7 ? 'moving' : rng() > 0.5 ? 'crumble' : 'static';
      platforms.push({
        x: px,
        y: py,
        w: pw,
        h: 16,
        kind,
        phase: randRange(rng, 0, Math.PI * 2),
        crumble: kind === 'crumble' ? 1.5 : 0,
      });
    }

    if (rng() > 0.55) {
      const tools = ['rope', 'light', 'glide', 'hook'];
      pickups.push({
        x: startX + randRange(rng, 200, width - 200),
        y: GROUND_Y - randRange(rng, 30, 120),
        type: pick(rng, tools),
        bob: randRange(rng, 0, Math.PI * 2),
      });
    }

    if (rng() > 0.92) {
      anchors.push({ x: startX + width * 0.5, y: GROUND_Y - 200, kind: 'rope' });
      anchors.push({ x: startX + width * 0.7, y: GROUND_Y - 120, kind: 'hook' });
    }

    const chunk = {
      key,
      startX,
      width,
      ground,
      platforms,
      hazards,
      pickups,
      anchors,
      biome: biome.current.id,
      branch: null,
    };

    if (distM >= this.nextRestM) {
      const rx = startX + width * 0.6;
      this.restPoints.push({ x: rx, y: GROUND_Y - 8, distM: this.nextRestM });
      chunk.restPoint = { x: rx, y: GROUND_Y };
      this.nextRestM += randInt(rng, 1500, 3000);
    }

    if (distM >= this.nextBranchM && rng() > 0.4) {
      const splitX = startX + width * 0.3;
      const mergeX = startX + width + randRange(rng, 400, 800);
      chunk.branch = {
        splitX,
        mergeX,
        hardYOffset: -100,
        easyYOffset: 40,
        reward: pick(rng, ['rope', 'glide', 'light', 'hook']),
        vista: rng() > 0.5,
      };
      this.branchZones.push(chunk.branch);
      this.nextBranchM += randInt(rng, 1500, 2500);
    }

    for (let i = this.chunks.size - 1; i >= 0; i--) {
      /* prune old chunks */
    }
    return chunk;
  }

  _makeHazard(type, x, rng, distM) {
    const base = { type, x, t: 0 };
    switch (type) {
      case 'gap':
        return { ...base, w: randRange(rng, 70, 140), y: GROUND_Y };
      case 'moving':
        return { ...base, y: GROUND_Y - 80, amp: randRange(rng, 40, 90), spd: randRange(rng, 1, 2) };
      case 'crumble':
        return { ...base, w: 100, y: GROUND_Y - 20 };
      case 'narrow':
        return { ...base, w: randRange(rng, 50, 80), y: GROUND_Y - 10 };
      case 'rocks':
        return { ...base, y: GROUND_Y - 300, interval: randRange(rng, 2, 4), next: randRange(rng, 1, 3) };
      case 'water':
        return { ...base, w: randRange(rng, 120, 200), y: GROUND_Y + 60, deep: true };
      case 'wind':
        return { ...base, w: 200, force: randRange(rng, 120, 280) };
      case 'ice':
        return { ...base, w: randRange(rng, 100, 220), y: GROUND_Y };
      case 'dark':
        return { ...base, w: randRange(rng, 150, 300) };
      case 'longGap':
        return { ...base, w: randRange(rng, 200, 320), y: GROUND_Y, needsTool: true };
      case 'wait':
        return { ...base, w: 80, duration: randRange(rng, 2, 5), timer: 0, blocked: true };
      default:
        return base;
    }
  }

  update(dt, playerX, player, tools) {
    const cx = playerX / ((CHUNK_MIN + CHUNK_MAX) / 2);
    for (let i = Math.floor(cx) - 1; i <= Math.floor(cx) + 3; i++) {
      const ch = this.getChunk(i);
      for (const pl of ch.platforms) {
        if (pl.kind === 'moving') {
          pl.y += Math.sin(pl.phase + playerX * 0.002) * 40 * dt;
          pl.phase += dt * 1.2;
        }
        if (pl.kind === 'crumble' && pl.crumble > 0) {
          const onPl =
            player.x > pl.x &&
            player.x < pl.x + pl.w &&
            Math.abs(player.y + PLAYER_RADIUS - pl.y) < 12;
          if (onPl) pl.crumble -= dt;
          if (pl.crumble <= 0) pl.broken = true;
        }
      }
      for (const h of ch.hazards) {
        h.t += dt;
        if (h.type === 'rocks') {
          h.next -= dt;
          if (h.next <= 0) {
            h.falling = { y: h.y, vy: 0, active: true };
            h.next = h.interval;
          }
          if (h.falling?.active) {
            h.falling.vy += 600 * dt;
            h.falling.y += h.falling.vy * dt;
            if (h.falling.y > GROUND_Y) {
              h.falling.active = false;
              h.falling.y = h.y;
            }
          }
        }
        if (h.type === 'wait' && h.blocked) {
          const near = Math.abs(player.x - h.x) < 60;
          if (near) h.timer += dt;
          if (h.timer >= h.duration) h.blocked = false;
        }
      }
      for (const pk of ch.pickups) {
        if (pk.taken) continue;
        pk.bob += dt * 3;
      }
    }

    this._pruneChunks(cx);
  }

  _pruneChunks(cx) {
    for (const key of this.chunks.keys()) {
      if (Math.abs(key - Math.floor(cx)) > 8) this.chunks.delete(key);
    }
  }

  groundYAt(x, path = 'main') {
    let best = GROUND_Y;
    const cx = x / ((CHUNK_MIN + CHUNK_MAX) / 2);
    const ch = this.getChunk(Math.floor(cx));
    if (!ch) return best;

    let yOff = 0;
    if (ch.branch) {
      if (x >= ch.branch.splitX && x < ch.branch.mergeX) {
        yOff = path === 'hard' ? ch.branch.hardYOffset : ch.branch.easyYOffset;
      }
    }

    for (const g of ch.ground) {
      if (x >= g.x && x < g.x + g.w) {
        best = g.y + yOff;
        break;
      }
    }
    for (const h of ch.hazards) {
      if (h.type === 'gap' || h.type === 'longGap') {
        if (x > h.x && x < h.x + h.w) return null;
      }
      if (h.type === 'water' && x > h.x && x < h.x + h.w) {
        return h.y;
      }
    }
    return best;
  }

  surfaceAt(x) {
    const cx = x / ((CHUNK_MIN + CHUNK_MAX) / 2);
    const ch = this.getChunk(Math.floor(cx));
    for (const g of ch.ground) {
      if (x >= g.x && x < g.x + g.w) return g.surface;
    }
    for (const h of ch.hazards) {
      if (h.type === 'ice' && x > h.x && x < h.x + h.w) return 'ice';
      if (h.type === 'mud') return 'mud';
    }
    return 'grass';
  }

  nearestRopeAnchor(px, py) {
    let best = null;
    let bd = 9999;
    for (const [, ch] of this.chunks) {
      for (const a of ch.anchors) {
        if (a.kind !== 'rope') continue;
        const d = Math.hypot(a.x - px, a.y - py);
        if (d < 220 && d < bd) {
          bd = d;
          best = a;
        }
      }
    }
    if (!best) {
      return { x: px + 120, y: py - 180 };
    }
    return best;
  }

  nearestHookAnchor(px, py, maxDist) {
    let best = null;
    let bd = maxDist;
    for (const [, ch] of this.chunks) {
      for (const a of ch.anchors) {
        if (a.kind !== 'hook') continue;
        const d = Math.hypot(a.x - px, a.y - py);
        if (d < bd) {
          bd = d;
          best = a;
        }
      }
      for (const pl of ch.platforms) {
        const d = Math.hypot(pl.x + pl.w / 2 - px, pl.y - py);
        if (d < bd) {
          bd = d;
          best = { x: pl.x + pl.w / 2, y: pl.y };
        }
      }
    }
    return best;
  }

  collectPickups(player, tools, audio, particles) {
    const cx = player.x / ((CHUNK_MIN + CHUNK_MAX) / 2);
    const ch = this.getChunk(Math.floor(cx));
    for (const pk of ch.pickups) {
      if (pk.taken) continue;
      const dy = pk.y + Math.sin(pk.bob) * 6;
      if (Math.hypot(player.x - pk.x, player.y - dy) < 36) {
        pk.taken = true;
        tools.add(pk.type, pk.type === 'light' ? 35 : 1);
        audio?.playSfx('pickup');
        particles.burst(pk.x, dy, 12, { vx: 0, vy: -40, life: 0.5, color: '#fff8c0', size: 4 });
      }
    }
  }

  checkHazards(player, tools, camera, audio, onDeath) {
    const cx = player.x / ((CHUNK_MIN + CHUNK_MAX) / 2);
    for (let i = Math.floor(cx) - 1; i <= Math.floor(cx) + 2; i++) {
      const ch = this.getChunk(i);
      for (const h of ch.hazards) {
        if (h.type === 'rocks' && h.falling?.active) {
          const rx = h.x;
          const ry = h.falling.y;
          if (Math.hypot(player.x - rx, player.y - ry) < 28) {
            onDeath();
            return;
          }
        }
        if (h.type === 'wind' && player.x > h.x && player.x < h.x + h.w) {
          player.windForce = h.force;
        }
        if (h.type === 'dark' && player.x > h.x && player.x < h.x + h.w) {
          if (!tools.lightActive()) player.inDark = true;
        }
      }
    }
    const gy = this.groundYAt(player.x, player.path);
    if (gy == null || player.y > gy + 120) {
      onDeath();
    }
  }

  drawParallax(ctx, camera, distM, biomeInfo) {
    const { current, next, blend } = biomeInfo;
    const pal = current.palette;
    const layers = 6;
    for (let L = 0; L < layers; L++) {
      const spd = (L + 1) * 0.08;
      const parX = -(camera.x * spd) % 400;
      ctx.fillStyle = pal[Math.min(L, pal.length - 1)];
      ctx.globalAlpha = 0.35 + L * 0.1;
      for (let i = -1; i < 5; i++) {
        const bx = parX + i * 400;
        const h = 80 + L * 40 + Math.sin(i + L) * 30;
        ctx.beginPath();
        ctx.moveTo(bx, GROUND_Y - 20);
        ctx.lineTo(bx + 120, GROUND_Y - h);
        ctx.lineTo(bx + 280, GROUND_Y - h * 0.7);
        ctx.lineTo(bx + 400, GROUND_Y - 20);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  draw(ctx, camera, player, tools, distM) {
    const cx = camera.x;
    const startChunk = Math.floor((cx - 200) / ((CHUNK_MIN + CHUNK_MAX) / 2));
    const endChunk = Math.floor((cx + 1280 + 200) / ((CHUNK_MIN + CHUNK_MAX) / 2));

    for (let i = startChunk; i <= endChunk; i++) {
      const ch = this.getChunk(i);
      for (const g of ch.ground) {
        const grad = ctx.createLinearGradient(g.x, g.y - 60, g.x, g.y + 40);
        grad.addColorStop(0, '#5a6a4a');
        grad.addColorStop(1, '#2a3a2a');
        ctx.fillStyle = grad;
        ctx.fillRect(g.x, g.y, g.w, 200);
      }
      for (const pl of ch.platforms) {
        if (pl.broken) continue;
        ctx.fillStyle = pl.kind === 'crumble' ? '#8a7a6a' : '#6a5a4a';
        ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
      }
      for (const h of ch.hazards) {
        this._drawHazard(ctx, h, tools);
      }
      for (const pk of ch.pickups) {
        if (pk.taken) continue;
        const dy = pk.y + Math.sin(pk.bob) * 6;
        ctx.save();
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#f0e8c0';
        ctx.beginPath();
        ctx.arc(pk.x, dy, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(pk.type[0].toUpperCase(), pk.x, dy + 4);
        ctx.restore();
      }
      if (ch.restPoint) {
        this._drawCampfire(ctx, ch.restPoint.x, ch.restPoint.y - 8);
      }
      if (ch.branch) {
        ctx.strokeStyle = 'rgba(255,200,100,0.4)';
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(ch.branch.splitX, GROUND_Y - 60);
        ctx.lineTo(ch.branch.splitX, GROUND_Y - 160);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const a of ch.anchors) {
        ctx.fillStyle = 'rgba(255,220,120,0.5)';
        ctx.beginPath();
        ctx.arc(a.x, a.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _drawHazard(ctx, h, tools) {
    switch (h.type) {
      case 'water':
        ctx.fillStyle = 'rgba(40,80,140,0.7)';
        ctx.fillRect(h.x, h.y, h.w, 80);
        break;
      case 'ice':
        ctx.fillStyle = 'rgba(200,230,255,0.45)';
        ctx.fillRect(h.x, h.y - 4, h.w, 12);
        break;
      case 'rocks':
        if (h.falling?.active) {
          ctx.fillStyle = '#5a5a5a';
          ctx.beginPath();
          ctx.arc(h.x, h.falling.y, 14, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'wait':
        if (h.blocked) {
          ctx.fillStyle = 'rgba(80,60,40,0.8)';
          ctx.fillRect(h.x - 20, GROUND_Y - 100, 40, 100);
        }
        break;
      default:
        break;
    }
  }

  _drawCampfire(ctx, x, y) {
    ctx.save();
    const t = Date.now() * 0.005;
    ctx.fillStyle = '#4a3020';
    ctx.fillRect(x - 20, y - 8, 40, 10);
    ctx.fillStyle = `rgba(255,${120 + Math.sin(t) * 40},40,0.9)`;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 8);
    ctx.lineTo(x, y - 28 - Math.sin(t) * 6);
    ctx.lineTo(x + 8, y - 8);
    ctx.fill();
    ctx.restore();
  }
}
