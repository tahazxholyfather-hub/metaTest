export type SfxName =
  | 'jump'
  | 'bounce'
  | 'land'
  | 'collect'
  | 'collect-rare'
  | 'secret'
  | 'hit'
  | 'damage'
  | 'death'
  | 'enemy-hit'
  | 'enemy-death'
  | 'ui-click'
  | 'ui-hover'
  | 'unlock'
  | 'level-complete'
  | 'spring'
  | 'portal'
  | 'laser'
  | 'boss-hit'
  | 'boss-phase'
  | 'checkpoint'

export type MusicName = 'menu' | 'season-1' | 'season-2' | 'season-3' | 'season-4' | 'boss'

const SFX_FILES: Record<SfxName, string> = {
  jump: 'assets/audio/sfx/jump.wav',
  bounce: 'assets/audio/sfx/bounce.wav',
  land: 'assets/audio/sfx/land.wav',
  collect: 'assets/audio/sfx/collect.wav',
  'collect-rare': 'assets/audio/sfx/collect-rare.wav',
  secret: 'assets/audio/sfx/secret.wav',
  hit: 'assets/audio/sfx/hit.wav',
  damage: 'assets/audio/sfx/damage.wav',
  death: 'assets/audio/sfx/death.wav',
  'enemy-hit': 'assets/audio/sfx/enemy-hit.wav',
  'enemy-death': 'assets/audio/sfx/enemy-death.wav',
  'ui-click': 'assets/audio/sfx/ui-click.wav',
  'ui-hover': 'assets/audio/sfx/ui-hover.wav',
  unlock: 'assets/audio/sfx/unlock.wav',
  'level-complete': 'assets/audio/sfx/level-complete.wav',
  spring: 'assets/audio/sfx/spring.wav',
  portal: 'assets/audio/sfx/portal.wav',
  laser: 'assets/audio/sfx/laser.wav',
  'boss-hit': 'assets/audio/sfx/boss-hit.wav',
  'boss-phase': 'assets/audio/sfx/boss-phase.wav',
  checkpoint: 'assets/audio/sfx/checkpoint.wav',
}

const MUSIC_FILES: Record<MusicName, string> = {
  menu: 'assets/audio/music/menu.wav',
  'season-1': 'assets/audio/music/season-1.wav',
  'season-2': 'assets/audio/music/season-2.wav',
  'season-3': 'assets/audio/music/season-3.wav',
  'season-4': 'assets/audio/music/season-4.wav',
  boss: 'assets/audio/music/boss.wav',
}

export class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private buffers = new Map<string, AudioBuffer>()
  private musicSource: AudioBufferSourceNode | null = null
  private currentMusic: MusicName | null = null
  private masterVol = 0.85
  private musicVol = 0.55
  private sfxVol = 0.85
  private muted = false
  private unlockBound = false

  readonly sfxManifest = SFX_FILES
  readonly musicManifest = MUSIC_FILES

  attach(ctx: AudioContext): void {
    this.ctx = ctx
    this.master = ctx.createGain()
    this.musicGain = ctx.createGain()
    this.sfxGain = ctx.createGain()
    this.musicGain.connect(this.master)
    this.sfxGain.connect(this.master)
    this.master.connect(ctx.destination)
    this.applyGains()
    this.armUnlock()
  }

  async loadAll(fetchBuffer: (url: string) => Promise<ArrayBuffer>): Promise<void> {
    const ctx = this.ensure()
    const entries = [
      ...Object.entries(SFX_FILES).map(([k, url]) => ['sfx:' + k, url] as const),
      ...Object.entries(MUSIC_FILES).map(([k, url]) => ['music:' + k, url] as const),
    ]
    await Promise.all(
      entries.map(async ([key, url]) => {
        try {
          const arr = await fetchBuffer(url)
          const buf = await ctx.decodeAudioData(arr.slice(0))
          this.buffers.set(key, buf)
        } catch (err) {
          console.warn('audio missing', url, err)
        }
      }),
    )
  }

  setVolumes(master: number, music: number, sfx: number, muted: boolean): void {
    this.masterVol = master
    this.musicVol = music
    this.sfxVol = sfx
    this.muted = muted
    this.applyGains()
  }

  playSfx(name: SfxName, opts: { volume?: number; detune?: number } = {}): void {
    const ctx = this.ctx
    const gain = this.sfxGain
    if (!ctx || !gain || this.muted) return
    const buf = this.buffers.get('sfx:' + name)
    if (!buf) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    if (opts.detune) src.detune.value = opts.detune
    const g = ctx.createGain()
    g.gain.value = opts.volume ?? 1
    src.connect(g)
    g.connect(gain)
    src.start()
  }

  playMusic(name: MusicName): void {
    if (this.currentMusic === name && this.musicSource) return
    this.stopMusic()
    const ctx = this.ctx
    const gain = this.musicGain
    if (!ctx || !gain) return
    const buf = this.buffers.get('music:' + name)
    if (!buf) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    src.connect(gain)
    src.start()
    this.musicSource = src
    this.currentMusic = name
  }

  stopMusic(): void {
    try {
      this.musicSource?.stop()
    } catch {
      /* already stopped */
    }
    this.musicSource = null
    this.currentMusic = null
  }

  resume(): void {
    void this.ctx?.resume()
  }

  private applyGains(): void {
    const mute = this.muted ? 0 : 1
    if (this.master) this.master.gain.value = this.masterVol * mute
    if (this.musicGain) this.musicGain.gain.value = this.musicVol
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVol
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.attach(new Ctx())
    }
    return this.ctx!
  }

  private armUnlock(): void {
    if (this.unlockBound) return
    this.unlockBound = true
    const unlock = () => {
      void this.ctx?.resume()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
  }
}
