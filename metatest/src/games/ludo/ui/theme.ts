import type { PlayerColor, TokenStatus } from '../engine'
import type { AICharacterState } from '../../../components/met/character'

export const PLAYER_THEME: Record<
  PlayerColor,
  { token: string; eye: string; accent: string; soft: string; glow: string; label: string }
> = {
  blue: {
    token: '#7EB4FF',
    eye: '#0E1628',
    accent: '#4C8DFF',
    soft: 'rgba(76, 141, 255, 0.16)',
    glow: 'rgba(76, 141, 255, 0.42)',
    label: 'Blue',
  },
  yellow: {
    token: '#F0D36A',
    eye: '#1A1608',
    accent: '#E2B93B',
    soft: 'rgba(226, 185, 59, 0.16)',
    glow: 'rgba(226, 185, 59, 0.4)',
    label: 'Yellow',
  },
  red: {
    token: '#F07A84',
    eye: '#1A0C10',
    accent: '#E85D6C',
    soft: 'rgba(232, 93, 108, 0.16)',
    glow: 'rgba(232, 93, 108, 0.4)',
    label: 'Red',
  },
  green: {
    token: '#6BDBA8',
    eye: '#0F1F19',
    accent: '#3ECF8E',
    soft: 'rgba(62, 207, 142, 0.16)',
    glow: 'rgba(62, 207, 142, 0.4)',
    label: 'Green',
  },
}

export const STATUS_TO_FACE: Record<TokenStatus, AICharacterState> = {
  HOME_IDLE: 'idle',
  HOME_SLEEP: 'sleepy',
  ENTERING: 'excited',
  IDLE: 'idle',
  SELECTABLE: 'curious',
  MOVING: 'excited',
  LANDING: 'happy',
  NEAR_ENEMY: 'surprised',
  ATTACKING: 'excited',
  CAPTURING: 'happy',
  CAPTURED: 'shocked',
  RETURNING_HOME: 'sad',
  BONUS_RECEIVED: 'excited',
  BONUS_ACTIVE: 'happy',
  WINNING: 'happy',
}
