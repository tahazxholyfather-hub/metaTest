import Phaser from 'phaser';
import { ObjectPool } from '@/src/utils/object-pool';
import { randRange } from '@/src/utils/math-utils';

interface Spark {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
}

export class ParticleSystem {
  private readonly active: Spark[] = [];
  private readonly pool: ObjectPool<Phaser.GameObjects.Image>;

  constructor(private readonly scene: Phaser.Scene) {
    this.pool = new ObjectPool(
      () => {
        const sprite = scene.add.image(0, 0, 'particle');
        sprite.setVisible(false);
        sprite.setDepth(20);
        return sprite;
      },
      (sprite) => {
        sprite.setVisible(false);
        sprite.setAlpha(1);
        sprite.setScale(1);
      },
      24,
      64,
    );
  }

  burst(x: number, y: number, count = 8): void {
    for (let i = 0; i < count; i += 1) {
      const sprite = this.pool.acquire();
      if (!sprite) return;
      sprite.setPosition(x, y);
      sprite.setVisible(true);
      this.active.push({
        sprite,
        vx: randRange(-80, 80),
        vy: randRange(-140, -20),
        life: randRange(0.25, 0.5),
      });
    }
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const spark = this.active[i];
      if (!spark) continue;
      spark.life -= dt;
      spark.vy += 420 * dt;
      spark.sprite.x += spark.vx * dt;
      spark.sprite.y += spark.vy * dt;
      spark.sprite.setAlpha(Math.max(0, spark.life * 2));
      if (spark.life <= 0) {
        this.pool.release(spark.sprite);
        this.active.splice(i, 1);
      }
    }
  }

  get stats(): { active: number; pooled: number } {
    return { active: this.active.length, pooled: this.pool.stats.free };
  }
}
