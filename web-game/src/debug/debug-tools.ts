import type { GameScene } from '@/src/scenes/game-scene';
import { getSaveManager } from '@/src/systems/save-manager';

export interface WebGameDebugApi {
  godMode: () => void;
  spawnEnemy: () => void;
  skipLevel: () => void;
  debugDraw: () => void;
  inspectSave: () => ReturnType<ReturnType<typeof getSaveManager>['load']>;
}

export const attachDebug = (scene: GameScene): void => {
  if (!import.meta.env.DEV) return;
  const api: WebGameDebugApi = {
    godMode: () => scene.setGodMode(true),
    spawnEnemy: () => scene.spawnEnemy(),
    skipLevel: () => scene.skipLevel(),
    debugDraw: () => scene.enableDebugDraw(),
    inspectSave: () => getSaveManager().load(),
  };
  (window as Window & { __webgame?: WebGameDebugApi }).__webgame = api;
};
