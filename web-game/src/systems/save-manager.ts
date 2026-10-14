import { SAVE_KEY } from '@/src/config/constants';
import { SAVE_VERSION, defaultSave, type SaveData } from '@/src/types/game-types';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export class SaveManager {
  private pending: SaveData | null = null;
  private timer = 0;

  constructor(
    private readonly store: KeyValueStore,
    private readonly key = SAVE_KEY,
  ) {}

  load(): SaveData {
    const raw = this.store.getItem(this.key);
    if (!raw) return defaultSave();
    try {
      return this.migrate(JSON.parse(raw) as unknown);
    } catch {
      return defaultSave();
    }
  }

  save(data: SaveData): void {
    this.store.setItem(this.key, JSON.stringify(this.migrate(data)));
  }

  scheduleSave(data: SaveData, debounceMs = 250): void {
    this.pending = data;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      if (this.pending) this.save(this.pending);
      this.pending = null;
    }, debounceMs);
  }

  exportSave(data: SaveData = this.load()): string {
    const json = JSON.stringify(this.migrate(data));
    return btoa(unescape(encodeURIComponent(json)));
  }

  importSave(encoded: string): SaveData {
    const json = decodeURIComponent(escape(atob(encoded)));
    const data = this.migrate(JSON.parse(json) as unknown);
    this.save(data);
    return data;
  }

  migrate(raw: unknown): SaveData {
    const base = defaultSave();
    if (!isRecord(raw)) return base;
    const version = typeof raw.version === 'number' ? raw.version : 0;
    const next: SaveData = {
      version: SAVE_VERSION,
      highScore: typeof raw.highScore === 'number' ? raw.highScore : base.highScore,
      muted: typeof raw.muted === 'boolean' ? raw.muted : base.muted,
      musicVolume: typeof raw.musicVolume === 'number' ? raw.musicVolume : base.musicVolume,
      sfxVolume: typeof raw.sfxVolume === 'number' ? raw.sfxVolume : base.sfxVolume,
    };
    if (version > SAVE_VERSION) return base;
    return next;
  }

  async syncCloud(_data: SaveData): Promise<void> {
    return Promise.resolve();
  }
}

const memory = (): KeyValueStore => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
};

let manager: SaveManager | null = null;

export const getSaveManager = (): SaveManager => {
  if (!manager) {
    const store = typeof localStorage === 'undefined' ? memory() : localStorage;
    manager = new SaveManager(store);
  }
  return manager;
};
