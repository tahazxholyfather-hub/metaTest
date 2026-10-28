import type { SoundId } from "../game/types";

export interface Sfx {
  enabled: boolean;
  unlock(): void;
  play(id: SoundId): void;
}

export function createSilentSfx(): Sfx {
  return {
    enabled: false,
    unlock() {},
    play() {},
  };
}

const TONES: Record<SoundId, { freq: number; dur: number; type: OscillatorType; gain: number }> = {
  shoot: { freq: 540, dur: 0.07, type: "triangle", gain: 0.04 },
  attach: { freq: 220, dur: 0.05, type: "sine", gain: 0.04 },
  react: { freq: 640, dur: 0.1, type: "triangle", gain: 0.05 },
  match: { freq: 880, dur: 0.12, type: "sine", gain: 0.05 },
  explode: { freq: 96, dur: 0.22, type: "sawtooth", gain: 0.06 },
  freeze: { freq: 980, dur: 0.08, type: "sine", gain: 0.03 },
  acid: { freq: 180, dur: 0.12, type: "square", gain: 0.03 },
  steam: { freq: 420, dur: 0.14, type: "sine", gain: 0.035 },
  energy: { freq: 1180, dur: 0.09, type: "square", gain: 0.03 },
  discover: { freq: 760, dur: 0.16, type: "triangle", gain: 0.05 },
  over: { freq: 140, dur: 0.28, type: "triangle", gain: 0.05 },
  ui: { freq: 480, dur: 0.04, type: "sine", gain: 0.03 },
  splash: { freq: 360, dur: 0.1, type: "sine", gain: 0.04 },
  crystal: { freq: 1040, dur: 0.09, type: "triangle", gain: 0.04 },
};

export class AudioBus implements Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;

  unlock(): void {
    const Ctx = window.AudioContext;
    if (!this.ctx) this.ctx = new Ctx();
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  play(id: SoundId): void {
    if (!this.enabled || !this.ctx) return;
    const tone = TONES[id];
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.freq, now);
    if (id === "react" || id === "discover") {
      osc.frequency.exponentialRampToValueAtTime(tone.freq * 1.5, now + tone.dur);
    }
    if (id === "over") {
      osc.frequency.exponentialRampToValueAtTime(70, now + tone.dur);
    }
    gain.gain.setValueAtTime(tone.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + tone.dur + 0.02);
  }
}
