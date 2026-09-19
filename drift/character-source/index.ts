export { AI_CHARACTER_STATES } from './types'
export type {
  AICharacterState,
  EyePose,
  Behavior,
  Gesture,
  GestureKey,
  StateDefinition,
} from './types'
export { CharacterEngine, DEFAULT_ENGINE_CONFIG } from './engine'
export type { EngineConfig } from './engine'
export { STATES, NEUTRAL_POSE } from './states'
export type { Vec2 } from './math'
export { drawCharacter, parseMatrix, BODY_COLOR, EYE_COLOR } from './canvasRender'
export type { CharacterDrawOptions } from './canvasRender'
export { subscribe as subscribeTicker } from './ticker'
