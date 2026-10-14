import Phaser from 'phaser';
import { Player } from '@/src/entities/player';
import { Enemy } from '@/src/entities/enemy';
import { InputSystem } from '@/src/systems/input-system';
import { CameraController } from '@/src/systems/camera-controller';
import { ParticleSystem } from '@/src/systems/particle-system';
import { getAudio } from '@/src/systems/audio-manager';
import { Dialog } from '@/src/ui/dialog';
import { attachDebug } from '@/src/debug/debug-tools';
import type { LevelData } from '@/src/types/game-types';
import {
  COIN_SCORE,
  FIXED_STEP_MS,
  GOAL_SCORE,
  HURT_LOCK_MS,
  MAX_LIVES,
  STOMP_BOUNCE,
  STOMP_SCORE,
} from '@/src/config/constants';

const isLevel = (value: unknown): value is LevelData => {
  if (typeof value !== 'object' || value === null) return false;
  return 'platforms' in value && 'spawn' in value && 'goal' in value;
};

export class GameScene extends Phaser.Scene {
  private inputSystem = new InputSystem();
  private player?: Player;
  private enemies: Enemy[] = [];
  private coins?: Phaser.Physics.Arcade.StaticGroup;
  private platforms?: Phaser.Physics.Arcade.StaticGroup;
  private particles?: ParticleSystem;
  private cameraControl?: CameraController;
  private dialog?: Dialog;
  private paused = false;
  private score = 0;
  private coinCount = 0;
  private lives = MAX_LIVES;
  private ended = false;
  private accumulator = 0;
  private level?: LevelData;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const raw = this.cache.json.get('level') as unknown;
    if (!isLevel(raw)) throw new Error('Level data missing');
    this.level = raw;
    this.score = 0;
    this.coinCount = 0;
    this.lives = MAX_LIVES;
    this.ended = false;
    this.paused = false;
    this.enemies = [];
    this.inputSystem = new InputSystem();
    this.inputSystem.attach(window);

    this.physics.world.setBounds(0, 0, raw.world.width, raw.world.height + 80);
    this.add.rectangle(raw.world.width / 2, raw.world.height / 2, raw.world.width, raw.world.height, 0x1b2438);

    this.platforms = this.physics.add.staticGroup();
    raw.platforms.forEach((platform) => {
      const tile = this.add.tileSprite(
        platform.x + platform.w / 2,
        platform.y + platform.h / 2,
        platform.w,
        platform.h,
        'platform',
      );
      const zone = this.add.zone(platform.x + platform.w / 2, platform.y + platform.h / 2, platform.w, platform.h);
      this.physics.add.existing(zone, true);
      this.platforms?.add(zone);
      tile.setDepth(1);
    });

    this.coins = this.physics.add.staticGroup();
    raw.coins.forEach((coin) => {
      const sprite = this.coins?.create(coin.x, coin.y, 'coin') as Phaser.Physics.Arcade.Sprite;
      sprite.setDepth(2);
      sprite.refreshBody();
    });

    raw.enemies.forEach((def) => {
      this.enemies.push(new Enemy(this, def.left, def.right, def.x, def.y));
    });

    const goal = this.physics.add.staticSprite(raw.goal.x, raw.goal.y, 'goal');
    goal.setDepth(2);
    goal.refreshBody();

    const player = new Player(this, raw.spawn.x, raw.spawn.y, this.inputSystem);
    this.player = player;
    const platforms = this.platforms;
    this.particles = new ParticleSystem(this);
    this.cameraControl = new CameraController(this.cameras.main);
    this.cameraControl.setBounds(raw.world.width, raw.world.height);
    this.cameraControl.follow(player.sprite);

    this.physics.add.collider(player.sprite, platforms);
    this.enemies.forEach((enemy) => {
      this.physics.add.collider(enemy.sprite, platforms);
    });
    this.physics.add.overlap(player.sprite, this.coins, (_player, coin) => {
      const sprite = coin as Phaser.Physics.Arcade.Sprite;
      if (!sprite.active) return;
      sprite.disableBody(true, true);
      this.coinCount += 1;
      this.addScore(COIN_SCORE);
      this.events.emit('coins-changed', this.coinCount);
      this.particles?.burst(sprite.x, sprite.y, 6);
      getAudio().playSfx('coin', this.pan(sprite.x));
    });
    this.enemies.forEach((enemy) => {
      this.physics.add.overlap(player.sprite, enemy.sprite, () => this.touchEnemy(enemy));
    });
    this.physics.add.overlap(player.sprite, goal, () => this.finish(true));

    this.dialog = new Dialog(
      this,
      'PAUSED',
      () => this.setPaused(false),
      () => {
        this.inputSystem.detach(window);
        this.scene.stop('UIScene');
        this.scene.start('MenuScene');
      },
    );

    this.scene.launch('UIScene');
    this.events.emit('score-changed', 0);
    this.events.emit('coins-changed', 0);
    this.events.emit('lives-changed', this.lives);
    attachDebug(this);
  }

  update(_time: number, delta: number): void {
    if (!this.player || this.ended) return;
    this.inputSystem.readPointer(this.input.activePointer);
    this.inputSystem.readGamepad();
    if (this.inputSystem.justPressed('pause')) this.setPaused(!this.paused);
    if (this.paused) {
      this.inputSystem.endFrame();
      return;
    }

    this.accumulator += delta;
    while (this.accumulator >= FIXED_STEP_MS) {
      const jumped = this.player.update(this.time.now);
      if (jumped) getAudio().playSfx('jump', this.pan(this.player.sprite.x));
      this.enemies.forEach((enemy) => enemy.update());
      this.accumulator -= FIXED_STEP_MS;
    }
    this.particles?.update(delta / 1000);
    this.cameraControl?.update();

    if (this.player.sprite.y > (this.level?.world.height ?? 270) + 40) this.hurt();
    this.inputSystem.endFrame();
  }

  addScore(amount: number): void {
    this.score += amount;
    this.events.emit('score-changed', this.score);
  }

  spawnEnemy(): void {
    if (!this.player) return;
    const x = this.player.sprite.x + 80;
    this.enemies.push(new Enemy(this, x - 40, x + 40, x, this.player.sprite.y));
    const enemy = this.enemies[this.enemies.length - 1];
    if (!enemy || !this.platforms || !this.player) return;
    this.physics.add.collider(enemy.sprite, this.platforms);
    this.physics.add.overlap(this.player.sprite, enemy.sprite, () => this.touchEnemy(enemy));
  }

  setGodMode(enabled: boolean): void {
    if (this.player) this.player.godMode = enabled;
  }

  skipLevel(): void {
    this.finish(true);
  }

  enableDebugDraw(): void {
    this.physics.world.createDebugGraphic();
  }

  private touchEnemy(enemy: Enemy): void {
    if (!this.player || !enemy.sprite.active) return;
    const stomped = this.player.falling && this.player.feet <= enemy.sprite.y + 6;
    if (stomped) {
      enemy.defeat();
      this.player.bounce(STOMP_BOUNCE);
      this.addScore(STOMP_SCORE);
      this.particles?.burst(enemy.sprite.x, enemy.sprite.y);
      getAudio().playSfx('stomp', this.pan(enemy.sprite.x));
      return;
    }
    this.hurt();
  }

  private hurt(): void {
    if (!this.player || this.ended) return;
    if (this.player.godMode || this.time.now < this.player.invulnerableUntil) return;
    this.lives -= 1;
    this.player.invulnerableUntil = this.time.now + HURT_LOCK_MS;
    this.events.emit('lives-changed', this.lives);
    this.cameras.main.shake(120, 0.006);
    getAudio().playSfx('hit');
    if (this.lives <= 0) {
      this.finish(false);
      return;
    }
    const spawn = this.level?.spawn;
    if (spawn) this.player.sprite.setPosition(spawn.x, spawn.y);
    this.player.sprite.body?.stop();
  }

  private finish(victory: boolean): void {
    if (this.ended) return;
    this.ended = true;
    if (victory) {
      this.addScore(GOAL_SCORE);
      getAudio().playSfx('win');
      getAudio().crossfadeTo('victory', 0.3);
    }
    this.inputSystem.detach(window);
    this.scene.stop('UIScene');
    this.scene.start('GameOverScene', {
      score: this.score,
      coins: this.coinCount,
      victory,
    });
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.physics.pause();
    else this.physics.resume();
    this.dialog?.setVisible(paused);
    this.events.emit('paused', { paused });
  }

  private pan(x: number): number {
    const view = this.cameras.main.worldView;
    if (view.width === 0) return 0;
    return (x - view.centerX) / (view.width / 2);
  }
}
