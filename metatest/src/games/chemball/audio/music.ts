export type MusicScene = "home" | "game";

/**
 * Candidate files per scene, tried in order. Drop tracks into `public/music/`.
 * Missing files are skipped silently, so the game runs fine with no music at all.
 */
export const MUSIC_TRACKS: Record<MusicScene, string[]> = {
  home: ["/music/home.mp3", "/music/home.ogg", "/music/home.wav"],
  game: ["/music/game.mp3", "/music/game.ogg", "/music/game.wav", "/music/home.mp3", "/music/home.ogg", "/music/home.wav"],
};

export interface MusicSettings {
  enabled: boolean;
  volume: number;
}

const STORAGE_KEY = "chemball-music-v1";
const FADE_MS = 900;
const DUCK = 0.35;

function loadSettings(): MusicSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<MusicSettings> | null;
    return {
      enabled: raw?.enabled ?? true,
      volume: typeof raw?.volume === "number" ? Math.min(1, Math.max(0, raw.volume)) : 0.6,
    };
  } catch {
    return { enabled: true, volume: 0.6 };
  }
}

async function isAudio(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok && (res.headers.get("content-type") ?? "").startsWith("audio");
  } catch {
    return false;
  }
}

/** Looping background music with per-scene tracks, crossfades, ducking and persisted settings. */
export class MusicPlayer {
  settings: MusicSettings = loadSettings();
  onChange: ((settings: MusicSettings) => void) | null = null;
  private scene: MusicScene | null = null;
  private unlocked = false;
  private ducked = false;
  private hidden = typeof document !== "undefined" && document.hidden;
  private resolved: Partial<Record<MusicScene, string | null>> = {};
  private elements = new Map<string, HTMLAudioElement>();
  private fades = new Map<HTMLAudioElement, number>();
  private readonly onVisibility = () => {
    this.hidden = document.hidden;
    this.sync();
  };

  constructor(private readonly tracks: Record<MusicScene, string[]> = MUSIC_TRACKS) {
    document.addEventListener("visibilitychange", this.onVisibility);
    for (const scene of Object.keys(tracks) as MusicScene[]) void this.resolve(scene);
  }

  /** Call from a user gesture so browsers allow playback. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    this.sync();
  }

  setScene(scene: MusicScene): void {
    this.scene = scene;
    this.sync();
  }

  /** Lowers the volume while menus or overlays cover the game. */
  setDucked(ducked: boolean): void {
    if (this.ducked === ducked) return;
    this.ducked = ducked;
    this.sync();
  }

  setEnabled(enabled: boolean): void {
    this.update({ ...this.settings, enabled });
  }

  setVolume(volume: number): void {
    this.update({ ...this.settings, volume: Math.min(1, Math.max(0, volume)) });
  }

  /** True once at least one track file was found. */
  get hasTracks(): boolean {
    return Object.values(this.resolved).some(Boolean);
  }

  dispose(): void {
    document.removeEventListener("visibilitychange", this.onVisibility);
    for (const frame of this.fades.values()) cancelAnimationFrame(frame);
    for (const el of this.elements.values()) {
      el.pause();
      el.src = "";
    }
    this.elements.clear();
  }

  private update(next: MusicSettings): void {
    this.settings = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    this.onChange?.(next);
    this.sync();
  }

  private async resolve(scene: MusicScene): Promise<void> {
    for (const url of this.tracks[scene]) {
      if (await isAudio(url)) {
        this.resolved[scene] = url;
        this.sync();
        return;
      }
    }
    this.resolved[scene] = null;
  }

  private target(): number {
    if (!this.settings.enabled || !this.unlocked || this.hidden) return 0;
    return this.settings.volume * (this.ducked ? DUCK : 1);
  }

  private element(url: string): HTMLAudioElement {
    let el = this.elements.get(url);
    if (!el) {
      el = new Audio(url);
      el.loop = true;
      el.preload = "auto";
      el.volume = 0;
      this.elements.set(url, el);
    }
    return el;
  }

  private sync(): void {
    const active = this.scene ? this.resolved[this.scene] : null;
    for (const [url, el] of this.elements) if (url !== active) this.fade(el, 0);
    if (active) this.fade(this.element(active), this.target());
  }

  private fade(el: HTMLAudioElement, to: number): void {
    const running = this.fades.get(el);
    if (running) cancelAnimationFrame(running);
    this.fades.delete(el);
    if (document.hidden) {
      el.volume = to;
      if (to === 0) el.pause();
      return;
    }
    if (to > 0 && el.paused) void el.play().catch(() => undefined);
    const from = el.volume;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / FADE_MS);
      el.volume = from + (to - from) * t;
      if (t < 1) {
        this.fades.set(el, requestAnimationFrame(step));
        return;
      }
      this.fades.delete(el);
      if (to === 0) el.pause();
    };
    this.fades.set(el, requestAnimationFrame(step));
  }
}
