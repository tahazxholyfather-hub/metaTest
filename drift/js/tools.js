/** Tool inventory and active tool behaviors. */

export const TOOL_IDS = ['rope', 'light', 'glide', 'hook'];

export const TOOL_META = {
  rope: { name: 'Rope', maxUses: 5, key: '1', color: '#c8a86a' },
  light: { name: 'Light', maxUses: 45, key: '2', color: '#f0e080' },
  glide: { name: 'Glide', maxUses: 1, key: '3', color: '#a8d8f0' },
  hook: { name: 'Hook', maxUses: 6, key: '4', color: '#b0b0c0' },
};

export class ToolInventory {
  constructor() {
    this.slots = { rope: 0, light: 0, glide: 0, hook: 0 };
    this.active = null;
    this.lightTimer = 0;
    this.glideTimer = 0;
    this.ropeAnchor = null;
    this.hookTarget = null;
    this.hookPulling = false;
  }

  add(type, amount = 1) {
    if (!this.slots[type]) this.slots[type] = 0;
    const max = TOOL_META[type].maxUses;
    this.slots[type] = Math.min(max, this.slots[type] + amount);
    if (!this.active && this.slots[type] > 0) this.active = type;
  }

  has(type) {
    return (this.slots[type] || 0) > 0;
  }

  canCombine(a, b) {
    const pair = [a, b].sort().join('+');
    return pair === 'glide+hook' || pair === 'glide+light' || pair === 'hook+rope';
  }

  use(type, player, world, audio) {
    if (!this.has(type)) return false;
    if (type === 'light') {
      this.lightTimer = this.slots.light;
      this.slots.light = 0;
      this.active = 'light';
      audio?.playSfx('pickup');
      return true;
    }
    if (type === 'glide' && !player.grounded && player.vy > 0) {
      this.glideTimer = 2.5;
      this.slots.glide -= 1;
      audio?.playSfx('glide');
      return true;
    }
    if (type === 'rope') {
      const anchor = world.nearestRopeAnchor(player.x, player.y);
      if (!anchor) return false;
      this.ropeAnchor = anchor;
      this.slots.rope -= 1;
      player.startRope(anchor);
      audio?.playSfx('rope');
      return true;
    }
    if (type === 'hook') {
      const anchor = world.nearestHookAnchor(player.x, player.y, 280);
      if (!anchor) return false;
      this.hookTarget = anchor;
      this.hookPulling = true;
      this.slots.hook -= 1;
      player.startHook(anchor);
      audio?.playSfx('hook');
      if (this.has('glide') && !player.grounded) {
        this.glideTimer = Math.max(this.glideTimer, 1.2);
      }
      return true;
    }
    return false;
  }

  update(dt, player) {
    if (this.lightTimer > 0) {
      this.lightTimer -= dt;
      if (this.lightTimer <= 0) this.active = null;
    }
    if (this.glideTimer > 0) {
      this.glideTimer -= dt;
      player.gliding = this.glideTimer > 0;
    } else {
      player.gliding = false;
    }
    if (!this.ropeAnchor && player.ropePhase === 'idle') {
      /* rope ended */
    }
    if (this.hookPulling && !player.hookActive) this.hookPulling = false;
  }

  lightActive() {
    return this.lightTimer > 0;
  }

  lightRadius() {
    const t = this.lightTimer;
    const flicker = t < 8 ? 0.85 + Math.sin(Date.now() * 0.02) * 0.15 : 1;
    return 180 * flicker;
  }
}
