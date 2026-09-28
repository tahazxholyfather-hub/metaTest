import { getElement } from "../data/elements";
import { getMaterial } from "../data/materials";
import { getReaction } from "../data/reactions";
import type { Sfx } from "../audio/sfx";
import type { PlayerProfile, RunRecord } from "../save/models";
import type { PlayerRepository } from "../save/repository";
import { Board, createBall } from "./board";
import { difficultyFactor, fallSpeed } from "./difficulty";
import { reactionFormula, reactionProductName } from "./formula";
import { cellCenter, cellInside, inBounds, makeLayout, neighborCoords } from "./hex";
import { mulberry32, type Rng } from "./rng";
import { chainBonus, levelFromXp, xpFromStats } from "./score";
import {
  applyCommand,
  bestUpCell,
  commandSig,
  findLoose,
  planCommand,
  predictForCommand,
  type Command,
  type EffectPrediction,
} from "./sim";
import { createInitialBoard, generateRow, nextShotElement, shiftDown } from "./spawn";
import type { Ball, DiscoveryNotice, HudSnapshot, Layout, RunStats, RunSummary, VisualStyle } from "./types";
import type { FloatText, Particle, ViewBall, ViewState } from "./view";

interface Phase {
  cmd: Command;
  prediction?: EffectPrediction;
  elapsed: number;
  duration: number;
  pulseIds: string[];
  morph?: {
    primaryId: string;
    otherIds: string[];
    from: VisualStyle;
    to: VisualStyle;
    glyph: string;
    formula: string;
    icon: string;
  };
  rise?: { id: string; x0: number; y0: number; x1: number; y1: number };
  clear?: Array<{ id: string; x: number; y: number; mode: "fall" | "rise" }>;
}

interface Look {
  kind: "element" | "material";
  icon: string;
  glyph: string;
  formula: string;
  style: VisualStyle;
}

export class GameEngine {
  animScale = 1;
  readonly trace: string[] = [];

  onHud: (hud: HudSnapshot) => void = () => {};
  onDiscovery: (notice: DiscoveryNotice) => void = () => {};
  onSummary: (summary: RunSummary) => void = () => {};

  private readonly rng: Rng;
  private layout: Layout = makeLayout(390, 844);
  private board: Board = new Board();
  private profile!: PlayerProfile;
  private ready = false;
  private dead = false;
  private ending = false;
  private paused = false;
  private status: HudSnapshot["status"] = "playing";
  private score = 0;
  private combo = 1;
  private chainSteps = 0;
  private chainLive = false;
  private elapsed = 0;
  private descent = 0;
  private driftTimer = 0;
  private aimAngle = -Math.PI / 2;
  private currentId = "H";
  private nextId = "O";
  private launcherBorn = 1;
  private shot: { elementId: string; x: number; y: number; vx: number; vy: number } | null = null;
  private phase: Phase | null = null;
  private queue: Command[] = [];
  private focus: string[] = [];
  private lastSig = "";
  private bestAtStart = 0;
  private stats: RunStats = emptyStats();
  private particles: Particle[] = [];
  private floats: FloatText[] = [];
  private shake = 0;
  private flash = 0;
  private banner = "";
  private bannerLife = 0;
  private hudSig = "";

  constructor(
    private readonly repo: PlayerRepository,
    private readonly audio: Sfx,
    seed = (Date.now() ^ (Math.floor(Math.random() * 0x7fffffff))) >>> 0,
  ) {
    this.rng = mulberry32(seed);
  }

  async init(): Promise<void> {
    this.profile = await this.repo.getPlayer();
    this.audio.enabled = this.profile.sound;
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.animScale = Math.min(this.animScale, 0.55);
    }
    this.restart();
    this.ready = true;
    this.emit();
  }

  dispose(): void {
    this.dead = true;
  }

  setLayout(layout: Layout): void {
    if (layout.width < 40 || layout.height < 40) return;
    this.layout = layout;
  }

  pause(paused: boolean): void {
    if (this.status === "gameover") return;
    this.paused = paused;
    this.status = paused ? "paused" : "playing";
    this.emit();
  }

  async rename(name: string): Promise<void> {
    const clean = name.trim().slice(0, 16) || "Reza";
    this.profile.name = clean;
    this.profile.avatar = clean.slice(0, 1).toUpperCase();
    await this.repo.savePlayer(this.profile);
    this.emit();
  }

  async setSound(enabled: boolean): Promise<void> {
    this.profile.sound = enabled;
    this.audio.enabled = enabled;
    await this.repo.savePlayer(this.profile);
    if (enabled) this.audio.play("ui");
    this.emit();
  }

  async leaderboard() {
    return this.repo.getLeaderboard(this.profile);
  }

  pointer(x: number, y: number): void {
    const dx = x - this.layout.launcherX;
    const dy = y - this.layout.launcherY;
    let angle = Math.atan2(dy, dx);
    if (angle > 0) angle = dx < 0 ? -Math.PI + 0.18 : -0.18;
    this.aimAngle = clamp(angle, -Math.PI + 0.18, -0.18);
  }

  unlockAudio(): void {
    this.audio.unlock();
  }

  shoot(): void {
    if (!this.ready || this.ending || this.paused || this.status !== "playing") return;
    if (this.shot || this.phase || this.queue.length || this.chainLive) return;
    const angle = this.aimAngle;
    this.shot = {
      elementId: this.currentId,
      x: this.layout.launcherX,
      y: this.layout.launcherY - this.layout.drawRadius * 0.2,
      vx: Math.cos(angle),
      vy: Math.sin(angle),
    };
    const factor = difficultyFactor(this.elapsed, this.score);
    this.currentId = this.nextId;
    this.nextId = nextShotElement(this.board, this.rng, factor);
    this.launcherBorn = 1;
    this.audio.play("shoot");
    if (!this.profile.hintSeen) {
      this.profile.hintSeen = true;
      void this.repo.savePlayer(this.profile);
      this.emit();
    }
  }

  /** Test hook: treat an element as if the shot just landed. */
  attachAt(col: number, row: number, elementId: string): void {
    if (this.board.occupied(col, row)) throw new Error(`cell ${col},${row} is occupied`);
    const ball = createBall({ kind: "element", elementId, col, row });
    ball.born = 0;
    this.board.add(ball);
    this.startChain(ball.id);
  }

  restart(): void {
    this.ending = false;
    this.paused = false;
    this.status = "playing";
    this.phase = null;
    this.queue = [];
    this.focus = [];
    this.chainLive = false;
    this.lastSig = "";
    this.shot = null;
    this.score = 0;
    this.combo = 1;
    this.chainSteps = 0;
    this.elapsed = 0;
    this.descent = 0;
    this.driftTimer = 0;
    this.particles = [];
    this.floats = [];
    this.shake = 0;
    this.flash = 0;
    this.banner = "";
    this.bannerLife = 0;
    this.trace.length = 0;
    this.stats = emptyStats();
    this.bestAtStart = this.profile.bestScore;
    this.aimAngle = -Math.PI / 2;
    const teach = this.profile.totalRuns === 0;
    this.board = createInitialBoard(this.rng, teach);
    this.currentId = teach ? "H" : nextShotElement(this.board, this.rng, 0);
    this.nextId = teach ? "O" : nextShotElement(this.board, this.rng, 0);
    this.launcherBorn = 1;
    this.emit();
  }

  update(dt: number): void {
    if (this.dead || !this.ready) return;
    const step = Math.min(0.05, Math.max(0, dt));
    this.updateJuice(step);
    if (this.ending || this.status === "gameover" || this.paused) return;
    this.elapsed += step;
    if (this.phase) {
      this.phase.elapsed += step;
      if (this.phase.elapsed >= this.phase.duration) this.commit();
      return;
    }
    if (this.chainLive || this.queue.length) {
      if (this.chainSteps >= 12 && this.queue.length === 0) {
        this.finishChain();
        return;
      }
      const cmd = this.queue.shift() ?? planCommand(this.board, this.focus);
      if (!cmd || this.repeated(cmd)) {
        this.finishChain();
        return;
      }
      this.beginPhase(cmd);
      return;
    }
    if (this.shot) {
      this.advanceShot(step);
      return;
    }
    this.drift(step);
    if (this.chainLive) return;
    this.descend(step);
  }

  snapshot(): ViewState {
    const layout = this.layout;
    const blankShot = this.ready ? this.makeViewBall(this.currentId, "element", layout.launcherX, layout.launcherY, 1 - this.launcherBorn * 0.25) : null;
    const next = this.ready
      ? this.makeViewBall(this.nextId, "element", Math.max(46, layout.drawRadius + 28), layout.launcherY + 10, 0.78)
      : null;
    const balls: ViewBall[] = [];
    const t = this.phase ? clamp(this.phase.elapsed / Math.max(0.0001, this.phase.duration), 0, 1) : 0;
    const eased = ease(t);
    if (this.ready) {
      for (const ball of this.board.all()) {
        const point = cellCenter(ball.col, ball.row, layout, this.descent);
        let x = point.x;
        let y = point.y;
        let alpha = 1;
        let scale = 1 - ball.born * 0.45;
        const look = this.look(ball);
        let style = look.style;
        let glyph = look.glyph;
        let formula = look.formula;
        let kind = look.kind;
        let icon = look.icon;
        const morph = this.phase?.morph;
        if (morph && morph.otherIds.includes(ball.id)) {
          const primary = this.board.getId(morph.primaryId);
          if (primary) {
            const target = cellCenter(primary.col, primary.row, layout, this.descent);
            x = lerp(x, target.x, eased);
            y = lerp(y, target.y, eased);
            alpha = 1 - eased;
            scale *= 1 - eased * 0.35;
          }
        }
        if (morph && morph.primaryId === ball.id) {
          style = mixStyle(morph.from, morph.to, eased);
          scale *= 1 + Math.sin(eased * Math.PI) * 0.14;
          if (eased > 0.5) {
            glyph = morph.glyph;
            formula = morph.formula;
            kind = "material";
            icon = morph.icon;
          }
        }
        if (this.phase?.rise?.id === ball.id) {
          x = lerp(this.phase.rise.x0, this.phase.rise.x1, eased);
          y = lerp(this.phase.rise.y0, this.phase.rise.y1, eased);
        }
        const clearing = this.phase?.clear?.find((item) => item.id === ball.id);
        if (clearing) {
          x = clearing.x;
          y = clearing.y + (clearing.mode === "fall" ? eased * 240 : -eased * 200);
          alpha = 1 - eased;
        }
        if (this.phase?.pulseIds.includes(ball.id)) scale *= 1 + Math.sin(eased * Math.PI) * 0.1;
        balls.push({
          x,
          y,
          r: layout.drawRadius,
          scale,
          alpha,
          kind,
          icon: kind === "material" ? iconFor(ball, icon) : "",
          glyph,
          formula,
          style,
          frost: ball.frozenShifts > 0,
        });
      }
    }
    const traced = this.ready && !this.shot && !this.phase && !this.chainLive ? this.traceAim() : { points: [], ghost: null };
    const splash = this.splashView(eased);
    const bolts = this.boltView(eased);
    const ring = this.ringView(eased);
    const shot = this.shot
      ? this.makeViewBall(this.shot.elementId, "element", this.shot.x, this.shot.y, 1)
      : null;
    return {
      width: layout.width,
      height: layout.height,
      balls,
      shot,
      trajectory: traced.points,
      ghost: traced.ghost,
      particles: this.particles.map((particle) => ({ ...particle })),
      floats: this.floats.map((float) => ({ ...float })),
      dangerY: layout.dangerY,
      launcherX: layout.launcherX,
      launcherY: layout.launcherY,
      aimAngle: this.aimAngle,
      current: this.shot ? null : blankShot,
      next,
      shake: this.shake,
      flash: this.flash,
      splash,
      bolts,
      ring,
      banner: this.banner,
      bannerLife: this.bannerLife,
    };
  }

  private startChain(ballId: string): void {
    this.chainLive = true;
    this.chainSteps = 0;
    this.combo = 1;
    this.focus = [ballId];
    this.queue = [{ type: "impact", ballId }];
    this.lastSig = "";
  }

  private beginPhase(cmd: Command): void {
    const prediction = predictForCommand(this.board, cmd);
    const phase: Phase = {
      cmd,
      prediction,
      elapsed: 0,
      duration: this.durationFor(cmd, prediction),
      pulseIds: [],
    };
    if (cmd.type === "reaction") {
      const reaction = getReaction(cmd.reactionId);
      const product = reaction.products[0];
      const primary = this.board.getId(cmd.primaryId);
      if (product && primary) {
        const mat = getMaterial(product.id);
        phase.morph = {
          primaryId: primary.id,
          otherIds: cmd.ballIds.filter((id) => id !== primary.id),
          from: this.look(primary).style,
          to: mat.visual,
          glyph: mat.formula,
          formula: mat.name,
          icon: mat.id,
        };
      }
      this.audio.play(reaction.soundEffect);
    } else if (cmd.type === "match") {
      phase.pulseIds = cmd.ballIds;
      this.audio.play(getMaterial(cmd.materialId).sound);
    } else if (cmd.type === "impact") {
      phase.pulseIds = [cmd.ballId];
      this.audio.play("attach");
    } else if (cmd.type === "explode") {
      this.shake = cmd.massive ? 11 : 6;
      this.flash = cmd.massive ? 0.42 : 0.24;
      this.audio.play("explode");
      const point = cellCenter(cmd.col, cmd.row, this.layout, this.descent);
      this.burst(point.x, point.y, cmd.massive ? 26 : 14, "#ffb15a");
    } else if (cmd.type === "effect") {
      this.audio.play(cmd.behavior === "corrode" ? "acid" : "react");
    } else if (cmd.type === "rise") {
      const ball = this.board.getId(cmd.ballId);
      if (ball) {
        const from = cellCenter(ball.col, ball.row, this.layout, this.descent);
        const dest = bestUpCell(this.board, ball);
        const to = dest ? cellCenter(dest.col, dest.row, this.layout, this.descent) : from;
        phase.rise = { id: ball.id, x0: from.x, y0: from.y, x1: to.x, y1: to.y };
      }
    } else if (cmd.type === "clear") {
      phase.clear = cmd.ballIds.flatMap((id) => {
        const ball = this.board.getId(id);
        if (!ball) return [];
        const point = cellCenter(ball.col, ball.row, this.layout, this.descent);
        return [{ id, x: point.x, y: point.y, mode: cmd.mode }];
      });
    }
    this.phase = phase;
  }

  private commit(): void {
    if (!this.phase) return;
    const { cmd, prediction } = this.phase;
    const result = applyCommand(this.board, cmd, prediction);
    this.trace.push(result.log);
    this.queue.push(...result.extra);
    this.focus = result.focusIds;
    this.grant(result);
    this.phase = null;
    this.emit();
  }

  private grant(result: ReturnType<typeof applyCommand>): void {
    this.stats.objectsDestroyed += result.removed;
    if (result.scoreBase > 0 && result.scoreKind !== "none") {
      let base = result.scoreBase;
      if (result.scoreKind === "reaction" && this.chainSteps > 0) base += 100;
      const used = this.combo;
      const points = Math.round(base * used);
      this.score += points;
      this.stats.score = this.score;
      const point = this.effectPoint(result);
      this.floats.push({
        x: point.x,
        y: point.y,
        text: `+${points.toLocaleString("en-US")}`,
        sub: `${labelFor(result)} ×${used}`,
        life: 0.95,
        max: 0.95,
        color: colorFor(result.scoreKind),
      });
      if (this.floats.length > 8) this.floats.splice(0, this.floats.length - 8);
    }
    if (!result.countsAsStep) return;
    this.chainSteps += 1;
    this.combo = Math.min(8, this.combo + 1);
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    if (result.scoreKind === "reaction" || result.scoreKind === "explosion") this.stats.reactionsCreated += 1;
    if (result.scoreKind === "match") this.stats.materialsMatched += 1;
    if (result.reactionId) this.discover(result.reactionId);
    if (result.materialId) this.unlock(result.materialId);
  }

  private finishChain(): void {
    if (!this.chainLive) return;
    if (this.chainSteps >= 2) this.stats.chainCount += 1;
    this.stats.highestChain = Math.max(this.stats.highestChain, this.chainSteps);
    const bonus = chainBonus(this.chainSteps, this.combo);
    if (bonus > 0) {
      this.score += bonus;
      this.stats.score = this.score;
      this.banner = `CHAIN ×${this.chainSteps}`;
      this.bannerLife = 1.15;
      this.floats.push({
        x: this.layout.width / 2,
        y: this.layout.height * 0.4,
        text: `+${bonus.toLocaleString("en-US")}`,
        sub: "CHAIN",
        life: 1.05,
        max: 1.05,
        color: "#ffe7a3",
      });
      this.audio.play("discover");
    }
    this.chainLive = false;
    this.combo = 1;
    this.queue = [];
    this.focus = [];
    this.lastSig = "";
    this.emit();
    if (this.danger()) this.endRun();
  }

  private repeated(cmd: Command): boolean {
    const sig = commandSig(cmd);
    if (sig === this.lastSig && cmd.type !== "rise") return true;
    this.lastSig = sig;
    return false;
  }

  private advanceShot(dt: number): void {
    if (!this.shot) return;
    let remain = 920 * dt;
    const step = this.layout.drawRadius * 0.42;
    while (remain > 0 && this.shot) {
      const distance = Math.min(step, remain);
      this.shot.x += this.shot.vx * distance;
      this.shot.y += this.shot.vy * distance;
      remain -= distance;
      if (this.shot.x < this.layout.drawRadius) {
        this.shot.x = this.layout.drawRadius;
        this.shot.vx = Math.abs(this.shot.vx);
      } else if (this.shot.x > this.layout.width - this.layout.drawRadius) {
        this.shot.x = this.layout.width - this.layout.drawRadius;
        this.shot.vx = -Math.abs(this.shot.vx);
      }
      if (this.shot.y <= this.layout.topLimit) {
        this.stick(this.shot.x, this.shot.y);
        return;
      }
      const hit = this.findHit(this.shot.x, this.shot.y);
      if (hit) {
        this.stick(this.shot.x, this.shot.y, hit);
        return;
      }
    }
  }

  private stick(x: number, y: number, hit?: Ball): void {
    if (!this.shot) return;
    let socket = hit ? this.closestOf(openNeighbors(this.board, hit), x, y) : null;
    if (!socket && y <= this.layout.topLimit + this.layout.drawRadius) {
      const row0: Array<[number, number]> = [];
      for (let col = 0; col < this.layout.cols; col += 1) {
        if (!this.board.occupied(col, 0) && cellInside(col, 0, this.layout)) row0.push([col, 0]);
      }
      socket = this.closestOf(row0, x, y);
    }
    if (!socket) socket = this.closestSocket(x, y);
    const elementId = this.shot.elementId;
    this.shot = null;
    if (!socket) return;
    const ball = createBall({ kind: "element", elementId, col: socket.col, row: socket.row });
    this.board.add(ball);
    this.burst(x, y, 8, getElement(elementId).visualStyle.glow);
    this.startChain(ball.id);
  }

  private descend(dt: number): void {
    const factor = difficultyFactor(this.elapsed, this.score);
    this.descent += fallSpeed(factor) * dt;
    if (this.danger()) {
      this.endRun();
      return;
    }
    if (this.descent < this.layout.ySpacing) return;
    this.descent -= this.layout.ySpacing;
    const touch = this.board
      .all()
      .filter((ball) => ball.row === 0 && ball.elementId)
      .map((ball) => ball.elementId!);
    shiftDown(this.board, generateRow(this.rng, factor, touch));
    if (this.danger()) {
      this.endRun();
      return;
    }
    const loose = findLoose(this.board);
    if (loose.fall.length || loose.rise.length) {
      this.chainLive = true;
      this.chainSteps = 0;
      this.combo = 1;
      this.focus = [];
      this.queue = [];
      this.lastSig = "";
    }
  }

  private drift(dt: number): void {
    if (this.elapsed < 2.4) return;
    this.driftTimer += dt;
    if (this.driftTimer < 0.9) return;
    this.driftTimer = 0;
    const gases = this.board
      .all()
      .filter((ball) => ball.materialId && (ball.materialId === "steam" || ball.materialId === "smoke") && ball.impulse <= 0 && ball.frozenShifts <= 0)
      .sort((a, b) => a.row - b.row)
      .slice(0, 4);
    const moved: string[] = [];
    for (const gas of gases) {
      if (gas.materialId === "steam" && gas.riseSteps >= 5) {
        gas.materialId = "water";
        gas.born = 0.8;
        gas.riseSteps = 0;
        moved.push(gas.id);
        continue;
      }
      const dest = bestUpCell(this.board, gas);
      if (!dest) continue;
      this.board.move(gas.id, dest.col, dest.row);
      gas.riseSteps += 1;
      moved.push(gas.id);
    }
    if (!moved.length) return;
    this.focus = moved;
    this.chainLive = true;
    this.chainSteps = 0;
    this.combo = 1;
    this.lastSig = "";
  }

  private danger(): boolean {
    for (const ball of this.board.all()) {
      const { y } = cellCenter(ball.col, ball.row, this.layout, this.descent);
      if (y + this.layout.drawRadius * 0.86 >= this.layout.dangerY) return true;
    }
    return false;
  }

  private endRun(): void {
    if (this.ending || this.status === "gameover") return;
    this.ending = true;
    this.shot = null;
    this.phase = null;
    this.queue = [];
    this.chainLive = false;
    const xpEarned = xpFromStats(this.stats);
    const isRecord = this.score > this.bestAtStart && this.score > 0;
    this.profile.xp += xpEarned;
    this.profile.level = levelFromXp(this.profile.xp);
    this.profile.totalRuns += 1;
    this.profile.totalScore += this.score;
    if (this.score > this.profile.bestScore) this.profile.bestScore = this.score;
    const run: RunRecord = {
      id: globalThis.crypto?.randomUUID?.() ?? `run-${Date.now()}`,
      score: this.score,
      xpEarned,
      maxCombo: this.stats.maxCombo,
      reactionsCreated: this.stats.reactionsCreated,
      materialsMatched: this.stats.materialsMatched,
      chainCount: this.stats.chainCount,
      objectsDestroyed: this.stats.objectsDestroyed,
      highestChain: this.stats.highestChain,
      duration: this.elapsed,
      createdAt: new Date().toISOString(),
    };
    const summary: RunSummary = {
      score: this.score,
      xpEarned,
      bestScore: this.profile.bestScore,
      isRecord,
      maxCombo: this.stats.maxCombo,
      reactionsCreated: this.stats.reactionsCreated,
      materialsMatched: this.stats.materialsMatched,
      chainCount: this.stats.chainCount,
      highestChain: this.stats.highestChain,
      objectsDestroyed: this.stats.objectsDestroyed,
    };
    this.audio.play("over");
    void this.repo.savePlayer(this.profile).then(() => this.repo.saveRun(run));
    this.status = "gameover";
    this.onSummary(summary);
    this.emit();
  }

  private discover(reactionId: string): void {
    if (this.profile.discoveredReactions.includes(reactionId)) return;
    this.profile.discoveredReactions.push(reactionId);
    const reaction = getReaction(reactionId);
    this.audio.play("discover");
    this.onDiscovery({
      id: `${reactionId}-${this.profile.discoveredReactions.length}`,
      reactionId,
      formula: reactionFormula(reaction),
      product: reactionProductName(reaction),
    });
    void this.repo.savePlayer(this.profile);
  }

  private unlock(materialId: string): void {
    if (this.profile.unlockedMaterials.includes(materialId)) return;
    this.profile.unlockedMaterials.push(materialId);
  }

  private updateJuice(dt: number): void {
    for (const ball of this.board.all()) {
      if (ball.born > 0) ball.born = Math.max(0, ball.born - dt * 3.1);
    }
    this.launcherBorn = Math.max(0, this.launcherBorn - dt * 3.4);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 1.4);
    this.bannerLife = Math.max(0, this.bannerLife - dt);
    this.particles = this.particles.filter((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 18 * dt;
      return particle.life > 0;
    });
    this.floats = this.floats.filter((float) => {
      float.life -= dt;
      float.y -= 28 * dt;
      return float.life > 0;
    });
  }

  private burst(x: number, y: number, count: number, color: string): void {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 110;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.35,
        max: 0.7,
        color,
        size: 1.5 + Math.random() * 2.4,
      });
    }
    if (this.particles.length > 160) this.particles.splice(0, this.particles.length - 160);
  }

  private traceAim(): { points: Array<{ x: number; y: number }>; ghost: { x: number; y: number } | null } {
    const points: Array<{ x: number; y: number }> = [];
    let x = this.layout.launcherX;
    let y = this.layout.launcherY - this.layout.drawRadius * 0.2;
    let vx = Math.cos(this.aimAngle);
    let vy = Math.sin(this.aimAngle);
    const step = this.layout.drawRadius * 0.48;
    for (let i = 0; i < 150; i += 1) {
      x += vx * step;
      y += vy * step;
      if (i % 2 === 0) points.push({ x, y });
      if (x < this.layout.drawRadius) {
        x = this.layout.drawRadius;
        vx = Math.abs(vx);
      } else if (x > this.layout.width - this.layout.drawRadius) {
        x = this.layout.width - this.layout.drawRadius;
        vx = -Math.abs(vx);
      }
      if (y <= this.layout.topLimit) return { points, ghost: this.ghostPixel(x, y) };
      const hit = this.findHit(x, y);
      if (hit) return { points, ghost: this.ghostPixel(x, y, hit) };
    }
    return { points, ghost: null };
  }

  private ghostPixel(x: number, y: number, hit?: Ball): { x: number; y: number } | null {
    let socket = hit ? this.closestOf(openNeighbors(this.board, hit), x, y) : null;
    if (!socket) socket = this.closestSocket(x, y);
    if (!socket) return null;
    return cellCenter(socket.col, socket.row, this.layout, this.descent);
  }

  private findHit(x: number, y: number): Ball | null {
    const limit = this.layout.drawRadius * 1.9;
    const limitSq = limit * limit;
    let best: Ball | null = null;
    let bestD = limitSq;
    for (const ball of this.board.all()) {
      const point = cellCenter(ball.col, ball.row, this.layout, this.descent);
      const d = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = ball;
      }
    }
    return best;
  }

  private closestOf(spots: Array<[number, number]>, x: number, y: number): { col: number; row: number } | null {
    let best: { col: number; row: number } | null = null;
    let bestD = Infinity;
    for (const [col, row] of spots) {
      const point = cellCenter(col, row, this.layout, this.descent);
      const d = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { col, row };
      }
    }
    return best;
  }

  private closestSocket(x: number, y: number): { col: number; row: number } | null {
    const spots: Array<[number, number]> = [];
    for (const ball of this.board.all()) spots.push(...openNeighbors(this.board, ball));
    for (let col = 0; col < this.layout.cols; col += 1) {
      if (!this.board.occupied(col, 0) && cellInside(col, 0, this.layout)) spots.push([col, 0]);
    }
    return this.closestOf(spots, x, y);
  }

  private splashView(t: number): ViewState["splash"] {
    const prediction = this.phase?.prediction;
    if (!prediction || prediction.splash.length === 0 || t < 0.32) return [];
    const u = clamp((t - 0.32) / 0.68, 0, 1);
    return prediction.splash.map((splash) => {
      const from = cellCenter(splash.fromCol, splash.fromRow, this.layout, this.descent);
      const to = cellCenter(splash.toCol, splash.toRow, this.layout, this.descent);
      return { x1: from.x, y1: from.y, x2: lerp(from.x, to.x, u), y2: lerp(from.y, to.y, u) };
    });
  }

  private boltView(t: number): ViewState["bolts"] {
    const prediction = this.phase?.prediction;
    if (!prediction || prediction.bolts.length === 0) return [];
    return prediction.bolts.flatMap((bolt) => {
      const from = this.board.getId(bolt.fromId);
      const to = this.board.getId(bolt.toId);
      if (!from || !to) return [];
      const a = cellCenter(from.col, from.row, this.layout, this.descent);
      const b = cellCenter(to.col, to.row, this.layout, this.descent);
      return [{ x1: a.x, y1: a.y, x2: lerp(a.x, b.x, t), y2: lerp(a.y, b.y, t) }];
    });
  }

  private ringView(t: number): ViewState["ring"] {
    if (this.phase?.cmd.type !== "explode") return null;
    const cmd = this.phase.cmd;
    const point = cellCenter(cmd.col, cmd.row, this.layout, this.descent);
    return {
      x: point.x,
      y: point.y,
      r: this.layout.drawRadius * (1.2 + t * (cmd.massive ? 7.2 : 4.6)),
      t,
      massive: cmd.massive,
    };
  }

  private effectPoint(result: ReturnType<typeof applyCommand>): { x: number; y: number } {
    if (this.phase?.cmd.type === "explode") {
      return cellCenter(this.phase.cmd.col, this.phase.cmd.row, this.layout, this.descent);
    }
    const id = result.focusIds[0];
    const ball = id ? this.board.getId(id) : undefined;
    if (ball) return cellCenter(ball.col, ball.row, this.layout, this.descent);
    return { x: this.layout.width / 2, y: this.layout.height * 0.42 };
  }

  private look(ball: Ball): Look {
    if (ball.kind === "element" && ball.elementId) {
      const element = getElement(ball.elementId);
      return { kind: "element", icon: "", glyph: element.symbol, formula: element.name, style: element.visualStyle };
    }
    const material = getMaterial(ball.materialId ?? "water");
    return { kind: "material", icon: material.id, glyph: material.formula, formula: material.name, style: material.visual };
  }

  private makeViewBall(id: string, kind: "element" | "material", x: number, y: number, scale: number): ViewBall {
    const style = kind === "element" ? getElement(id).visualStyle : getMaterial(id).visual;
    const glyph = kind === "element" ? getElement(id).symbol : getMaterial(id).formula;
    const formula = kind === "element" ? getElement(id).name : getMaterial(id).name;
    return {
      x,
      y,
      r: this.layout.drawRadius,
      scale,
      alpha: 1,
      kind,
      icon: kind === "material" ? id : "",
      glyph,
      formula,
      style,
      frost: false,
    };
  }

  private durationFor(cmd: Command, prediction?: EffectPrediction): number {
    const scale = this.animScale;
    switch (cmd.type) {
      case "impact":
        return 0.1 * scale;
      case "reaction":
        return 0.44 * scale;
      case "match":
        return (prediction && prediction.splash.length ? 0.64 : 0.46) * scale;
      case "effect":
        return 0.4 * scale;
      case "explode":
        return (cmd.massive ? 0.56 : 0.46) * scale;
      case "rise":
        return 0.26 * scale;
      case "clear":
        return 0.48 * scale;
    }
  }

  private hud(): HudSnapshot {
    return {
      status: this.status,
      score: this.score,
      combo: this.combo,
      name: this.profile?.name ?? "Reza",
      avatar: this.profile?.avatar ?? "R",
      level: this.profile?.level ?? 1,
      xp: this.profile?.xp ?? 0,
      bestScore: this.profile?.bestScore ?? 0,
      hint: !!this.profile && !this.profile.hintSeen && this.status === "playing",
      sound: this.profile?.sound ?? true,
      discovered: this.profile?.discoveredReactions ?? [],
    };
  }

  private emit(): void {
    if (!this.profile) return;
    const hud = this.hud();
    const sig = `${hud.status}|${hud.score}|${hud.name}|${hud.hint}|${hud.sound}|${hud.bestScore}|${hud.xp}|${hud.level}|${hud.discovered.join(",")}`;
    if (sig === this.hudSig) return;
    this.hudSig = sig;
    this.onHud(hud);
  }
}

function openNeighbors(board: Board, ball: Ball): Array<[number, number]> {
  return neighborCoords(ball.col, ball.row).filter(
    ([col, row]) => inBounds(col, row) && !board.occupied(col, row),
  );
}

function iconFor(ball: Ball, fallback: string): string {
  return ball.materialId ?? fallback;
}

function labelFor(result: ReturnType<typeof applyCommand>): string {
  if (result.scoreKind === "explosion") return "BOOM";
  if (result.scoreKind === "match" && result.materialId) return getMaterial(result.materialId).name.toUpperCase();
  if (result.scoreKind === "reaction") return "REACT";
  if (result.scoreKind === "clear") return "CLEAR";
  return "SCORE";
}

function colorFor(kind: ReturnType<typeof applyCommand>["scoreKind"]): string {
  if (kind === "explosion") return "#ffb15a";
  if (kind === "match") return "#8dffa8";
  if (kind === "reaction") return "#9fd8ff";
  return "#d5dced";
}

function emptyStats(): RunStats {
  return {
    score: 0,
    xp: 0,
    maxCombo: 1,
    reactionsCreated: 0,
    materialsMatched: 0,
    chainCount: 0,
    objectsDestroyed: 0,
    highestChain: 0,
    duration: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function ease(t: number): number {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
}

function mixStyle(a: VisualStyle, b: VisualStyle, t: number): VisualStyle {
  return {
    base: mixHex(a.base, b.base, t),
    glow: mixHex(a.glow, b.glow, t),
    rim: mixHex(a.rim, b.rim, t),
    ink: mixHex(a.ink, b.ink, t),
  };
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const u = clamp(t, 0, 1);
  const mixed = pa.map((channel, index) => Math.round(channel + (pb[index]! - channel) * u));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}
