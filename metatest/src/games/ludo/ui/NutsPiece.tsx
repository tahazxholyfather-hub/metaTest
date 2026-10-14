import type { CSSProperties } from 'react'
import { AICharacter } from '../../../components/met/character'
import type { Vec2 } from '../../../components/met/character'
import type { TokenState } from '../engine'
import { STATUS_TO_FACE, PLAYER_THEME } from './theme'

interface NutsPieceProps {
  token: TokenState
  lookAt: Vec2 | null
  selected: boolean
  selectable: boolean
  hopping: boolean
  reducedMotion: boolean
  onSelect: (id: string) => void
  style: CSSProperties
}

export function NutsPiece({
  token,
  lookAt,
  selected,
  selectable,
  hopping,
  reducedMotion,
  onSelect,
  style,
}: NutsPieceProps) {
  const theme = PLAYER_THEME[token.color]
  const face = STATUS_TO_FACE[token.status]
  const ghost = token.status === 'CAPTURED' || token.status === 'RETURNING_HOME'
  const clickable = selectable && token.status === 'SELECTABLE'

  return (
    <button
      type="button"
      className={[
        'ludo-nuts',
        selected ? 'is-selected' : '',
        selectable ? 'is-selectable' : '',
        hopping ? 'is-hopping' : '',
        ghost ? 'is-ghost' : '',
        token.status === 'RETURNING_HOME' ? 'is-returning' : '',
        token.status === 'NEAR_ENEMY' ? 'is-nervous' : '',
        token.status === 'ENTERING' ? 'is-entering' : '',
        token.location.kind === 'home' ? 'is-home' : '',
      ].join(' ')}
      style={{ ...style, ['--nuts-glow' as string]: theme.glow }}
      onClick={() => clickable && onSelect(token.id)}
      disabled={!clickable}
      aria-label={`${theme.label} Nuts ${token.index + 1}`}
    >
      <span className="ludo-nuts-shadow" />
      <AICharacter
        state={face}
        color={theme.token}
        eyeColor={theme.eye}
        interactive={false}
        lookAt={lookAt}
        intensity={token.status === 'HOME_SLEEP' ? 0.85 : 1}
        reducedMotion={reducedMotion}
        size="100%"
        label={`${theme.label} Nuts`}
      />
    </button>
  )
}
