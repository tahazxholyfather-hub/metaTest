export type SoundName =
  | 'dice-roll'
  | 'dice-result'
  | 'move'
  | 'land'
  | 'spawn'
  | 'collect'
  | 'bonus'
  | 'capture'
  | 'return-home'
  | 'victory'
  | 'ui'

interface AudioSettings {
  sound: boolean
  music: boolean
}

const STORAGE_KEY = 'metch-ludo-audio'

export class AudioSystem {
  private ctx: AudioContext | null = null
  private settings: AudioSettings
  private reduced = false

  constructor() {
    this.settings = loadSettings()
  }

  get soundEnabled(): boolean {
    return this.settings.sound
  }

  get musicEnabled(): boolean {
    return this.settings.music
  }

  setReducedMotion(value: boolean): void {
    this.reduced = value
  }

  toggleSound(): boolean {
    this.settings.sound = !this.settings.sound
    saveSettings(this.settings)
    return this.settings.sound
  }

  toggleMusic(): boolean {
    this.settings.music = !this.settings.music
    saveSettings(this.settings)
    return this.settings.music
  }

  play(name: SoundName): void {
    if (!this.settings.sound || this.reduced) return
    const ctx = this.ensure()
    if (!ctx) return
    void ctx.resume()
    switch (name) {
      case 'dice-roll':
        sweep(ctx, 220, 640, 0.12, 'triangle', 0.05)
        break
      case 'dice-result':
        blip(ctx, 620, 0.09, 'sine', 0.06)
        blip(ctx, 920, 0.07, 'sine', 0.04, 0.05)
        break
      case 'move':
        blip(ctx, 340, 0.05, 'triangle', 0.03)
        break
      case 'land':
        blip(ctx, 180, 0.08, 'sine', 0.05)
        break
      case 'spawn':
        sweep(ctx, 480, 920, 0.16, 'sine', 0.04)
        break
      case 'collect':
        blip(ctx, 740, 0.07, 'sine', 0.05)
        blip(ctx, 1100, 0.09, 'sine', 0.04, 0.06)
        break
      case 'bonus':
        blip(ctx, 520, 0.08, 'triangle', 0.05)
        blip(ctx, 780, 0.1, 'triangle', 0.04, 0.08)
        break
      case 'capture':
        blip(ctx, 260, 0.1, 'square', 0.03)
        sweep(ctx, 420, 180, 0.18, 'sine', 0.04)
        break
      case 'return-home':
        sweep(ctx, 360, 140, 0.28, 'sine', 0.035)
        break
      case 'victory':
        melody(ctx, [523, 659, 784, 1046], 0.14)
        break
      case 'ui':
        blip(ctx, 500, 0.04, 'sine', 0.025)
        break
    }
  }

  playMusic(): void {
    if (!this.settings.music || this.reduced) return
    const ctx = this.ensure()
    if (!ctx) return
    void ctx.resume()
    melody(ctx, [392, 494, 587, 523, 659], 0.16)
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
    }
    return this.ctx
  }
}

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { sound: true, music: true, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { sound: true, music: true }
}

function saveSettings(settings: AudioSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}

function blip(
  ctx: AudioContext,
  freq: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  delay = 0,
): void {
  const t = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function sweep(ctx: AudioContext, from: number, to: number, dur: number, type: OscillatorType, gain: number): void {
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, t)
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function melody(ctx: AudioContext, notes: number[], step: number): void {
  notes.forEach((note, i) => blip(ctx, note, step * 0.85, 'sine', 0.045, i * step))
}
