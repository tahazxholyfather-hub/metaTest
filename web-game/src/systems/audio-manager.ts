import { AUDIO } from '@/src/config/asset-manifest';
import { ObjectPool } from '@/src/utils/object-pool';
import { clamp } from '@/src/utils/math-utils';

interface Voice {
  gain: GainNode | null;
  busy: boolean;
}

const MAX_VOICES = 12;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private currentMusic: AudioBufferSourceNode | null = null;
  private currentMusicKey = '';
  private muted = false;
  private musicVolume = 0.45;
  private sfxVolume = 0.8;
  private unlocked = false;
  private readonly voices: ObjectPool<Voice>;

  constructor() {
    this.voices = new ObjectPool<Voice>(
      () => ({ gain: null, busy: false }),
      (voice) => {
        voice.busy = false;
      },
      MAX_VOICES,
      MAX_VOICES,
    );
  }

  async loadAll(): Promise<void> {
    const entries: [string, string][] = [
      ['theme', AUDIO.music.theme],
      ['victory', AUDIO.music.victory],
      ...Object.entries(AUDIO.sfx),
    ];
    await Promise.all(entries.map(([key, url]) => this.load(key, url)));
  }

  async load(key: string, url: string): Promise<void> {
    const ctx = this.ensureContext();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Audio failed: ${url}`);
    const encoded = await response.arrayBuffer();
    const buffer = await ctx.decodeAudioData(encoded.slice(0));
    this.buffers.set(key, buffer);
  }

  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') void ctx.resume();
    this.unlocked = true;
  }

  playMusic(key: string): void {
    if (!this.unlocked || this.currentMusicKey === key) return;
    this.crossfadeTo(key, 0.4);
  }

  crossfadeTo(key: string, seconds: number): void {
    const ctx = this.ensureContext();
    const buffer = this.buffers.get(key);
    const musicGain = this.musicGain;
    if (!buffer || !musicGain) return;
    const nextGain = ctx.createGain();
    nextGain.gain.value = 0;
    nextGain.connect(musicGain);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = key === 'theme';
    source.connect(nextGain);
    source.start();
    const now = ctx.currentTime;
    nextGain.gain.linearRampToValueAtTime(1, now + seconds);
    if (this.currentMusic) {
      const previous = this.currentMusic;
      const previousGain = previous.context.createGain();
      previous.stop(now + seconds);
      void previousGain;
    }
    this.currentMusic?.stop(now + seconds);
    this.currentMusic = source;
    this.currentMusicKey = key;
  }

  playSfx(key: string, pan = 0): void {
    if (!this.unlocked || this.muted) return;
    const ctx = this.ensureContext();
    const buffer = this.buffers.get(key);
    const sfxGain = this.sfxGain;
    if (!buffer || !sfxGain) return;
    const voice = this.voices.acquire();
    if (!voice) return;
    const gain = ctx.createGain();
    gain.gain.value = this.sfxVolume;
    const panner = ctx.createStereoPanner();
    panner.pan.value = clamp(pan, -1, 1);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(panner);
    panner.connect(sfxGain);
    voice.gain = gain;
    voice.busy = true;
    source.onended = () => this.voices.release(voice);
    source.start();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.musicGain) this.musicGain.gain.value = muted ? 0 : this.musicVolume;
    if (this.sfxGain) this.sfxGain.gain.value = muted ? 0 : 1;
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = clamp(volume, 0, 1);
    if (this.musicGain && !this.muted) this.musicGain.gain.value = this.musicVolume;
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = clamp(volume, 0, 1);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  private ensureContext(): AudioContext {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    this.musicGain = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.musicGain.gain.value = this.muted ? 0 : this.musicVolume;
    this.sfxGain.gain.value = this.muted ? 0 : 1;
    this.musicGain.connect(ctx.destination);
    this.sfxGain.connect(ctx.destination);
    this.ctx = ctx;
    return ctx;
  }
}

let audio: AudioManager | null = null;

export const getAudio = (): AudioManager => {
  if (!audio) audio = new AudioManager();
  return audio;
};
