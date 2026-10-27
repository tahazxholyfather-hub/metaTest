export type MusicScene = "home" | "game";

/**
 * Optional tracks live in `src/audio/tracks` and are bundled only when the file exists.
 * A missing upload is never requested.
 */
const TRACK_FILES = import.meta.glob("./tracks/*.{mp3,ogg,wav}", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const HOME_NAMES = ["home.mp3", "home.ogg", "home.wav"];
const GAME_NAMES = ["game.mp3", "game.ogg", "game.wav", ...HOME_NAMES];

export interface MusicSettings {
  enabled: boolean;
  volume: number;
}

const STORAGE_KEY = "chemball-music-v1";
const FADE_MS = 900;
const DUCK = 0.35;

export function trackCatalog(files: Record<string, string> = TRACK_FILES): Map<string, string> {
  const catalog = new Map<string, string>();
  for (const [path, url] of Object.entries(files)) {
    const name = path.split("/").pop();
    if (name && url) catalog.set(name, url);
  }
  return catalog;
}

/** The single bundled URL for a scene, or null when no optional file is present. */
export function resolveSceneTrack(scene: MusicScene, catalog = trackCatalog()): string | null {
  const names = scene === "home" ? HOME_NAMES : GAME_NAMES;
  for (const name of names) {
    const url = catalog.get(name);
    if (url) return url;
  }
  return null;
}

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

/** Looping background music. Only files discovered at build time are loaded. */
export class MusicPlayer {
  settings: MusicSettings = loadSettings();
  onChange: ((settings: MusicSettings) => void) | null = null;
  private scene: MusicScene | null = null;
  private unlocked = false;
  private ducked = false;
  private hidden = typeof document !== "undefined" && document.hidden;
  private readonly resolved: Record<MusicScene, string | null>;
  private elements = new Map<string, HTMLAudioElement>();
  private fades = new Map<HTMLAudioElement, number>();
  private failed = new Set<string>();
  private readonly onVisibility = () => {
    this.hidden = document.hidden;
    this.sync();
  };

  constructor(catalog = trackCatalog()) {
    this.resolved = {
      home: resolveSceneTrack("home", catalog),
      game: resolveSceneTrack("game", catalog),
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.onVisibility);
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

  /** True once at least one bundled track exists. */
  get hasTracks(): boolean {
    return Boolean(this.resolved.home || this.resolved.game);
  }

  dispose(): void {
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onVisibility);
    for (const frame of this.fades.values()) cancelAnimationFrame(frame);
    for (const el of this.elements.values()) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    this.elements.clear();
  }

  private update(next: MusicSettings): void {
    this.settings = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    this.onChange?.(next);
    this.sync();
  }

  private target(): number {
    if (!this.settings.enabled || !this.unlocked || this.hidden) return 0;
    return this.settings.volume * (this.ducked ? DUCK : 1);
  }

  private element(url: string): HTMLAudioElement {
    let el = this.elements.get(url);
    if (!el) {
      el = new Audio();
      el.loop = true;
      el.preload = "auto";
      el.volume = 0;
      el.src = url;
      el.addEventListener("error", () => {
        this.failed.add(url);
        el?.pause();
        el?.removeAttribute("src");
      }, { once: true });
      this.elements.set(url, el);
    }
    return el;
  }

  private sync(): void {
    const active = this.scene ? this.resolved[this.scene] : null;
    const playable = active && !this.failed.has(active) ? active : null;
    for (const [url, el] of this.elements) if (url !== playable) this.fade(el, 0);
    if (playable) this.fade(this.element(playable), this.target());
  }

  private fade(el: HTMLAudioElement, to: number): void {
    const running = this.fades.get(el);
    if (running) cancelAnimationFrame(running);
    this.fades.delete(el);
    if (typeof document !== "undefined" && document.hidden) {
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
