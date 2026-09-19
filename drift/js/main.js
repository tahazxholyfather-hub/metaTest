import { CANVAS_W, CANVAS_H, GROUND_Y, meters } from './utils.js';
import { biomeAtDistance, blendedSky } from './biomes.js';
import { Camera } from './camera.js';
import { ParticleSystem } from './particles.js';
import { AudioManager } from './audio.js';
import { ToolInventory, TOOL_IDS } from './tools.js';
import { World } from './world.js';
import { Player } from './player.js';
import { UI } from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');

const camera = new Camera();
const particles = new ParticleSystem();
const audio = new AudioManager();
const tools = new ToolInventory();
const world = new World(Date.now() % 100000);
const player = new Player(120, GROUND_Y - 14);
const ui = new UI(overlay);

let state = 'title';
let record = Number(localStorage.getItem('drift-record') || 0);
let restTimer = 0;
let deathTimer = 0;
let lastBiome = null;

const input = {
  axis: 0,
  jump: false,
  jumpPressed: false,
  keys: {},
};

function resize() {
  const scale = Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H);
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  canvas.style.width = `${CANVAS_W * scale}px`;
  canvas.style.height = `${CANVAS_H * scale}px`;
}
resize();
window.addEventListener('resize', resize);

window.addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  if (state === 'title' && (e.code === 'Enter' || e.code === 'Space')) startGame();
  if (state === 'playing') {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      input.jump = true;
      input.jumpPressed = true;
    }
    const left = e.code === 'ArrowLeft' || e.code === 'KeyA';
    const right = e.code === 'ArrowRight' || e.code === 'KeyD';
    if (left) input.axis = -1;
    if (right) input.axis = 1;
    if (e.code === 'Digit1') tools.use('rope', player, world, audio);
    if (e.code === 'Digit2') tools.use('light', player, world, audio);
    if (e.code === 'Digit3') tools.use('glide', player, world, audio);
    if (e.code === 'Digit4') tools.use('hook', player, world, audio);
    if (e.code === 'KeyE' && player.atRest && restTimer > 2) leaveRest();
  }
  if (state === 'dead' && deathTimer > 1) respawn();
});

window.addEventListener('keyup', (e) => {
  input.keys[e.code] = false;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') input.jump = false;
  const left = input.keys.ArrowLeft || input.keys.KeyA;
  const right = input.keys.ArrowRight || input.keys.KeyD;
  input.axis = left && !right ? -1 : right && !left ? 1 : 0;
});

canvas.addEventListener('click', () => {
  audio.resume();
  if (state === 'title') startGame();
});

function startGame() {
  ui.hideTitle();
  audio.init();
  audio.resume();
  state = 'playing';
  player.resetToCheckpoint();
}

function onDeath() {
  if (player.dead) return;
  player.die();
  audio.playSfx('death');
  camera.shakeScreen(10, 0.2);
  state = 'dead';
  deathTimer = 0;
  ui.showDeathContinue(player.checkpoint.distM || meters(player.x));
}

function respawn() {
  player.resetToCheckpoint();
  state = 'playing';
  ui.hideDeath();
  camera.shakeScreen(0);
  camera.zoom = 1;
}

function enterRest(rp) {
  player.atRest = true;
  player.setCheckpoint(rp.x, rp.y - 14, rp.distM);
  restTimer = 0;
  audio.setBiome(lastBiome, true);
  audio.playSfx('fire');
  ui.showRest(rp.distM, false);
  camera.startPan(rp.x);
}

function leaveRest() {
  player.atRest = false;
  ui.hideRest();
  audio.setBiome(lastBiome, false);
}

let lastTime = 0;
function loop(ts) {
  const dt = Math.min(0.033, (ts - lastTime) / 1000 || 0.016);
  lastTime = ts;

  if (state === 'playing' || state === 'dead') {
    if (state === 'playing') {
      world.update(dt, player.x, player, tools);
      tools.update(dt, player);
      player.update(dt, input, world, tools, audio, camera);
      world.collectPickups(player, tools, audio, particles);
      world.checkHazards(player, tools, camera, audio, onDeath);

      const distM = meters(player.x);
      const biomeInfo = biomeAtDistance(distM);
      if (biomeInfo.current.id !== lastBiome) {
        lastBiome = biomeInfo.current.id;
        audio.setBiome(lastBiome, player.atRest);
      }

      for (const rp of world.restPoints) {
        if (!rp.used && Math.abs(player.x - rp.x) < 40 && player.grounded) {
          rp.used = true;
          enterRest(rp);
        }
      }

      if (player.atRest) {
        restTimer += dt;
        ui.showRest(player.checkpoint.distM, restTimer > 2);
        if (restTimer > 2 && Object.values(input.keys).some(Boolean)) leaveRest();
      }

      const branch = world.getChunk(Math.floor(player.x / 1050))?.branch;
      if (branch && player.x > branch.splitX && player.x < branch.splitX + 30) {
        if (input.axis < 0) player.path = 'hard';
        else if (input.axis > 0) player.path = 'easy';
      }
      if (branch && player.x > branch.mergeX) player.path = 'main';

      const m = meters(player.x);
      if (m > record) {
        record = m;
        localStorage.setItem('drift-record', String(Math.floor(record)));
      }

      let camCtx = 'normal';
      if (player.vy > 300 && !player.grounded) camCtx = 'fall';
      else if (player.vx > 240) camCtx = 'fast';
      else if (player.atRest) camCtx = 'rest';
      camera.update(dt, player, camCtx);

      particles.setAmbient(
        biomeInfo.current.particles,
        biomeInfo.current.fog + 0.3,
        camera.x,
        biomeInfo.current.palette,
      );
      particles.update(dt, camera.x, camera.y);
    } else {
      deathTimer += dt;
      player.update(dt, input, world, tools, audio, camera);
      camera.update(dt, player, 'death');
      if (deathTimer > 2.5) respawn();
    }

    input.jumpPressed = false;

    draw(biomeAtDistance(meters(player.x)));
  }

  requestAnimationFrame(loop);
}

function draw(biomeInfo) {
  const sky = blendedSky(biomeInfo);
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, sky.top);
  grad.addColorStop(1, sky.bot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  camera.apply(ctx);
  world.drawParallax(ctx, camera, meters(player.x), biomeInfo);
  world.draw(ctx, camera, player, tools, meters(player.x));
  particles.draw(ctx, camera.x);
  player.draw(ctx, tools);

  const dark = biomeInfo.current.dark && !tools.lightActive();
  if (dark || player.inDark) {
    ctx.fillStyle = tools.lightActive() ? 'rgba(0,0,10,0.55)' : 'rgba(0,0,8,0.82)';
    ctx.fillRect(camera.x - 100, camera.y - 100, CANVAS_W + 200, CANVAS_H + 200);
    player.drawLight(ctx, tools);
  }

  camera.release(ctx);

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  const v = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.35, CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();

  ui.updateDistance(player.x, record);
  ui.updateTools(tools);
}

requestAnimationFrame(loop);
