import type { ThemeId } from './types'
import type { Settings } from './save'

export type MusicId = ThemeId | 'menu'

const STEPS = [0, 2, 4, 7, 4, 2, 7, 12]

const ROOT: Record<MusicId, number> = {
  menu: 220,
  meadow: 247,
  canyon: 196,
  cove: 262,
  ridge: 175,
  dusk: 156,
}

interface Tone {
  freq: number
  dur: number
  type: OscillatorType
  gain: number
  slide: number
  music: boolean
}

export class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicBus: GainNode | null = null
  private sfxBus: GainNode | null = null
  private noise: AudioBuffer | null = null
  private unlocked = false
  private wanted: MusicId = 'menu'
  private playing: MusicId | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private cursor = 0
  private step = 0
  private settings: Settings

  constructor(settings: Settings) {
    this.settings = settings
  }

  unlock(): void {
    const ctx = this.ensure()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    this.unlocked = true
    if (this.playing !== this.wanted) this.startLoop()
  }

  playTheme(id: MusicId): void {
    this.wanted = id
    if (!this.unlocked) return
    if (this.playing === id) return
    this.startLoop()
  }

  stopTheme(): void {
    this.playing = null
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  applySettings(settings: Settings): void {
    this.settings = settings
    this.pushGains()
  }

  ui(): void {
    this.tone({ freq: 620, dur: 0.06, type: 'sine', gain: 0.05, slide: 80, music: false })
  }

  jump(): void {
    this.tone({ freq: 280, dur: 0.09, type: 'sine', gain: 0.06, slide: 140, music: false })
  }

  land(): void {
    this.tone({ freq: 140, dur: 0.08, type: 'triangle', gain: 0.05, slide: -60, music: false })
    this.noiseBurst(0.05, 0.04)
  }

  bounce(): void {
    this.tone({ freq: 420, dur: 0.14, type: 'triangle', gain: 0.07, slide: 220, music: false })
  }

  collect(): void {
    this.tone({ freq: 660, dur: 0.07, type: 'square', gain: 0.035, slide: 0, music: false })
    this.tone({ freq: 880, dur: 0.1, type: 'square', gain: 0.03, slide: 40, music: false })
  }

  checkpoint(): void {
    this.tone({ freq: 392, dur: 0.12, type: 'triangle', gain: 0.06, slide: 0, music: false })
    this.tone({ freq: 523, dur: 0.16, type: 'triangle', gain: 0.05, slide: 0, music: false })
  }

  die(): void {
    this.tone({ freq: 220, dur: 0.22, type: 'sawtooth', gain: 0.04, slide: -140, music: false })
  }

  complete(): void {
    const notes = [523, 659, 784, 1046]
    notes.forEach((freq, i) => {
      window.setTimeout(() => {
        this.tone({ freq, dur: 0.16, type: 'triangle', gain: 0.06, slide: 0, music: false })
      }, i * 90)
    })
  }

  splash(): void {
    this.noiseBurst(0.12, 0.05)
  }

  dispose(): void {
    this.stopTheme()
    void this.ctx?.close()
    this.ctx = null
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    const ctx = new Ctx()
    const master = ctx.createGain()
    const music = ctx.createGain()
    const sfx = ctx.createGain()
    music.connect(master)
    sfx.connect(master)
    master.connect(ctx.destination)
    this.ctx = ctx
    this.master = master
    this.musicBus = music
    this.sfxBus = sfx
    this.pushGains()
    const samples = ctx.sampleRate * 0.2
    const buffer = ctx.createBuffer(1, samples, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1
    this.noise = buffer
    return ctx
  }

  private pushGains(): void {
    if (!this.master || !this.musicBus || !this.sfxBus) return
    const mute = this.settings.muted ? 0 : this.settings.master
    this.master.gain.value = mute
    this.musicBus.gain.value = this.settings.music
    this.sfxBus.gain.value = this.settings.sfx
  }

  private startLoop(): void {
    this.playing = this.wanted
    this.step = 0
    if (this.timer !== null) clearTimeout(this.timer)
    const ctx = this.ctx
    this.cursor = ctx ? ctx.currentTime + 0.05 : 0
    this.loop()
  }

  private loop = (): void => {
    const ctx = this.ctx
    if (!ctx || !this.playing || !this.unlocked) return
    const now = ctx.currentTime
    if (this.cursor < now) this.cursor = now + 0.02
    const root = ROOT[this.playing]
    const semi = STEPS[this.step % STEPS.length]
    const freq = root * 2 ** (semi / 12)
    this.tone({ freq, dur: 0.22, type: 'triangle', gain: 0.045, slide: 0, music: true })
    if (this.step % 4 === 0) {
      this.tone({ freq: freq / 2, dur: 0.34, type: 'sine', gain: 0.03, slide: 0, music: true })
    }
    this.step += 1
    this.cursor += this.playing === 'menu' ? 0.46 : 0.3
    const wait = Math.max(30, (this.cursor - ctx.currentTime) * 1000)
    this.timer = setTimeout(this.loop, wait)
  }

  private tone(tone: Tone): void {
    const ctx = this.ctx
    const bus = tone.music ? this.musicBus : this.sfxBus
    if (!ctx || !bus || !this.unlocked) return
    const t = tone.music ? Math.max(ctx.currentTime, this.cursor) : ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = tone.type
    osc.frequency.setValueAtTime(Math.max(40, tone.freq), t)
    if (tone.slide !== 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, tone.freq + tone.slide), t + tone.dur)
    }
    gain.gain.setValueAtTime(tone.gain, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.dur)
    osc.connect(gain)
    gain.connect(bus)
    osc.start(t)
    osc.stop(t + tone.dur + 0.02)
  }

  private noiseBurst(dur: number, gainValue: number): void {
    const ctx = this.ctx
    if (!ctx || !this.noise || !this.sfxBus || !this.unlocked) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 800
    const gain = ctx.createGain()
    const t = ctx.currentTime
    gain.gain.setValueAtTime(gainValue, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.sfxBus)
    src.start(t)
    src.stop(t + dur)
  }
}
