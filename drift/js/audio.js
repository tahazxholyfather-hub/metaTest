/** Web Audio — procedural layers per biome + SFX. */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.layers = [];
    this.currentBiome = null;
    this.enabled = true;
    this._rest = false;
  }

  async init() {
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.5;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.6;
      this.sfxGain.connect(this.master);
      this._startAmbience();
    } catch {
      this.enabled = false;
    }
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  _osc(freq, type, gain, dest) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    o.connect(g);
    g.connect(dest);
    o.start();
    return { o, g };
  }

  _startAmbience() {
    if (!this.ctx) return;
    const drone = this._osc(55, 'sine', 0.08, this.musicGain);
    const pad = this._osc(110, 'triangle', 0.04, this.musicGain);
    this.layers = [drone, pad];
  }

  setBiome(id, atRest = false) {
    this._rest = atRest;
    if (!this.ctx || id === this.currentBiome) return;
    this.currentBiome = id;
    const freqs = {
      forest: [65, 98],
      mountain: [49, 73],
      rain: [55, 82],
      darkForest: [41, 62],
      cave: [36, 54],
      ice: [72, 108],
      highAlt: [60, 90],
    }[id] || [55, 82];
    if (this.layers[0]) this.layers[0].o.frequency.setTargetAtTime(freqs[0], this.ctx.currentTime, 3);
    if (this.layers[1]) this.layers[1].o.frequency.setTargetAtTime(freqs[1], this.ctx.currentTime, 3);
    const vol = atRest ? 0.25 : 0.5;
    this.musicGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 2);
  }

  playSfx(name) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.connect(g);
    g.connect(this.sfxGain);
    const presets = {
      jump: { f: 320, type: 'sine', dur: 0.12, vol: 0.15 },
      land: { f: 120, type: 'triangle', dur: 0.08, vol: 0.12 },
      pickup: { f: 520, type: 'sine', dur: 0.2, vol: 0.18 },
      death: { f: 80, type: 'sine', dur: 0.5, vol: 0.2 },
      fire: { f: 90, type: 'sawtooth', dur: 0.3, vol: 0.05 },
      rope: { f: 200, type: 'triangle', dur: 0.15, vol: 0.1 },
      hook: { f: 280, type: 'square', dur: 0.1, vol: 0.08 },
      glide: { f: 160, type: 'sine', dur: 0.25, vol: 0.1 },
    };
    const p = presets[name] || presets.pickup;
    o.type = p.type;
    o.frequency.setValueAtTime(p.f, t);
    o.frequency.exponentialRampToValueAtTime(p.f * 0.5, t + p.dur);
    g.gain.setValueAtTime(p.vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + p.dur);
    o.start(t);
    o.stop(t + p.dur);
  }

  footstep(surface) {
    if (!this.ctx || Math.random() > 0.35) return;
    const f = surface === 'ice' ? 180 : surface === 'mud' ? 90 : 140;
    this.playSfx('land');
    if (this.layers[1]) {
      this.layers[1].o.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.02);
    }
  }
}
