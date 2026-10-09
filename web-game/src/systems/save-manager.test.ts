import { describe, expect, it } from 'vitest';
import { SaveManager, type KeyValueStore } from '@/src/systems/save-manager';

const memoryStore = (): KeyValueStore => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
};

describe('SaveManager', () => {
  it('migrates partial saves and round-trips export', () => {
    const saves = new SaveManager(memoryStore());
    const migrated = saves.migrate({ highScore: 40 });
    expect(migrated.highScore).toBe(40);
    expect(migrated.version).toBe(1);
    saves.save(migrated);
    const imported = saves.importSave(saves.exportSave());
    expect(imported.highScore).toBe(40);
    expect(saves.load().muted).toBe(false);
  });
});
