import type { SettingsData } from './types'

type SfxName =
  | 'jump'
  | 'bounce'
  | 'land'
  | 'collect'
  | 'collect-rare'
  | 'collect-secret'
  | 'enemy-hit'
  | 'enemy-death'
  | 'damage'
  | 'ui-click'
  | 'ui-hover'
  | 'unlock'
  | 'complete'
  | 'secret'
  | 'checkpoint'
  | 'spring'
  | 'portal'
  | 'boss-hit'
  | 'boss-phase'
  | 'death'
  | 'whoosh'

type MusicName = 'menu' | 's1' | 's2' | 's3' | 's4' | 'boss1' | 'boss2' | 'boss3' | 'boss4'

const SFX_FILES: Record<SfxName, string> = {
  jump: 'assets/audio/sfx/jump.wav',
  bounce: 'assets/audio/sfx/bounce.wav',
  land: 'assets/audio/sfx/land.wav',
  collect: 'assets/audio/sfx/collect.wav',
  'collect-rare': 'assets/audio/sfx/collect-rare.wav',
  'collect-secret': 'assets/audio/sfx/collect-secret.wav',
  'enemy-hit': 'assets/audio/sfx/enemy-hit.wav',
  'enemy-death': 'assets/audio/sfx/enemy-death.wav',
  damage: 'assets/audio/sfx/damage.wav',
  'ui-click': 'assets/audio/sfx/ui-click.wav',
  'ui-hover': 'assets/audio/sfx/ui-hover.wav',
  unlock: 'assets/audio/sfx/unlock.wav',
  complete: 'assets/audio/sfx/complete.wav',
  secret: 'assets/audio/sfx/secret.wav',
  checkpoint: 'assets/audio/sfx/checkpoint.wav',
  spring: 'assets/audio/sfx/spring.wav',
  portal: 'assets/audio/sfx/portal.wav',
  'boss-hit': 'assets/audio/sfx/boss-hit.wav',
  'boss-phase': 'assets/audio/sfx/boss-phase.wav',
  death: 'assets/audio/sfx/death.wav',
  whoosh: 'assets/audio/sfx/whoosh.wav',
}

const MUSIC_FILES: Record<MusicName, string> = {
  menu: 'assets/audio/music/menu.wav',
  s1: 'assets/audio/music/season-1.wav',
  s2: 'assets/audio/music/season-2.wav',
  s3: 'assets/audio/music/season-3.wav',
  s4: 'assets/audio/music/season-4.wav',
  boss1: 'assets/audio/music/boss-1.wav',
  boss2: 'assets/audio/music/boss-2.wav',
  boss3: 'assets/audio/music/boss-3.wav',
  boss4: 'assets/audio/music/boss-4.wav',
}

/**
 * Web-Audio mixer. Loads replaceable WAV assets; synthesizes a fallback
 * if a file is missing so the game is never silent.
 */
export class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private buffers = new Map<string, AudioBuffer>()
  private musicSource: AudioBufferSourceNode | null = null
  private currentMusic: MusicName | null = null
  private settings: SettingsData
  private unlocking = false
  private loaded = false

  constructor(settings: SettingsData) {
    this.settings = settings
  }

  applySettings(s: SettingsData): void {
    this.settings = s
    this.updateGains()
  }

  async unlock(): Promise<void> {
    if (this.unlocking) return
    this.unlocking = true
    const ctx = this.ensure()
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        /* autoplay policy */
      }
    }
    if (!this.loaded) {
      await this.preload()
      this.loaded = true
    }
  }

  async preload(): Promise<void> {
    const ctx = this.ensure()
    const entries = [...Object.entries(SFX_FILES), ...Object.entries(MUSIC_FILES)]
    await Promise.all(
      entries.map(async ([, url]) => {
        try {
          const res = await fetch(url)
          if (!res.ok) return
          const raw = await res.arrayBuffer()
          const buf = await ctx.decodeAudioData(raw.slice(0))
          this.buffers.set(url, buf)
        } catch {
          /* fallback synth later */
        }
      }),
    )
  }

  playSfx(name: SfxName, opts: { detune?: number; gain?: number; pan?: number } = {}): void {
    if (this.settings.muted) return
    const ctx = this.ensure()
    const url = SFX_FILES[name]
    const buf = this.buffers.get(url)
    const dest = this.sfxGain!
    const gain = ctx.createGain()
    gain.gain.value = opts.gain ?? 1
    const pan = ctx.createStereoPanner()
    pan.pan.value = opts.pan ?? 0
    gain.connect(pan).connect(dest)

    if (buf) {
      const src = ctx.createBufferSource()
      src.buffer = buf
      if (opts.detune) src.detune.value = opts.detune
      src.connect(gain)
      src.start()
      return
    }
    this.synthSfx(name, gain)
  }

  playMusic(name: MusicName): void {
    if (this.currentMusic === name && this.musicSource) return
    this.stopMusic()
    this.currentMusic = name
    const ctx = this.ensure()
    const url = MUSIC_FILES[name]
    const buf = this.buffers.get(url)
    if (!buf) {
      this.synthMusic(name)
      return
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    src.connect(this.musicGain!)
    src.start()
    this.musicSource = src
  }

  stopMusic(): void {
    try {
      this.musicSource?.stop()
    } catch {
      /* already stopped */
    }
    this.musicSource = null
    this.currentMusic = null
    this.stopSynthMusic()
  }

  private synthNodes: AudioNode[] = []

  private stopSynthMusic(): void {
    for (const n of this.synthNodes) {
      try {
        n.disconnect()
      } catch {
        /* ignore */
      }
    }
    this.synthNodes = []
  }

  private synthMusic(name: MusicName): void {
    const ctx = this.ensure()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = name.startsWith('boss') ? 'sawtooth' : 'triangle'
    const base = name === 's2' || name.startsWith('boss') ? 110 : name === 's3' ? 196 : name === 's4' ? 146 : 164
    osc.frequency.value = base
    gain.gain.value = 0.04
    osc.connect(gain).connect(this.musicGain!)
    osc.start()
    this.synthNodes.push(osc, gain)
  }

  private synthSfx(name: SfxName, dest: GainNode): void {
    const ctx = this.ensure()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    const now = ctx.currentTime
    const table: Record<string, { f: number; t: OscillatorType; d: number }> = {
      jump: { f: 420, t: 'triangle', d: 0.12 },
      bounce: { f: 280, t: 'sine', d: 0.1 },
      land: { f: 140, t: 'sine', d: 0.08 },
      collect: { f: 880, t: 'triangle', d: 0.12 },
      'collect-rare': { f: 988, t: 'triangle', d: 0.18 },
      'collect-secret': { f: 1174, t: 'sine', d: 0.28 },
      'enemy-hit': { f: 200, t: 'square', d: 0.08 },
      'enemy-death': { f: 160, t: 'sawtooth', d: 0.2 },
      damage: { f: 90, t: 'sawtooth', d: 0.18 },
      'ui-click': { f: 640, t: 'triangle', d: 0.05 },
      'ui-hover': { f: 520, t: 'sine', d: 0.04 },
      unlock: { f: 523, t: 'triangle', d: 0.3 },
      complete: { f: 392, t: 'triangle', d: 0.4 },
      secret: { f: 784, t: 'sine', d: 0.35 },
      checkpoint: { f: 660, t: 'triangle', d: 0.16 },
      spring: { f: 340, t: 'triangle', d: 0.14 },
      portal: { f: 240, t: 'sine', d: 0.22 },
      'boss-hit': { f: 80, t: 'sawtooth', d: 0.16 },
      'boss-phase': { f: 60, t: 'square', d: 0.4 },
      death: { f: 70, t: 'sawtooth', d: 0.4 },
      whoosh: { f: 180, t: 'sine', d: 0.15 },
    }
    const spec = table[name] ?? { f: 440, t: 'sine' as OscillatorType, d: 0.1 }
    o.type = spec.t
    o.frequency.setValueAtTime(spec.f, now)
    o.frequency.exponentialRampToValueAtTime(Math.max(40, spec.f * 0.45), now + spec.d)
    g.gain.setValueAtTime(0.12, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + spec.d)
    o.connect(g).connect(dest)
    o.start(now)
    o.stop(now + spec.d + 0.02)
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.musicGain = this.ctx.createGain()
      this.sfxGain = this.ctx.createGain()
      this.musicGain.connect(this.master)
      this.sfxGain.connect(this.master)
      this.master.connect(this.ctx.destination)
      this.updateGains()
    }
    return this.ctx
  }

  private updateGains(): void {
    if (!this.master || !this.musicGain || !this.sfxGain) return
    const mute = this.settings.muted ? 0 : 1
    this.master.gain.value = this.settings.master * mute
    this.musicGain.gain.value = this.settings.music
    this.sfxGain.gain.value = this.settings.sfx
  }
}
