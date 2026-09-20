import { useMemo } from 'react'
import {
  HOME_STRETCH,
  HOME_YARD,
  MAIN_PATH,
  START_INDEX,
  cellKey,
  chebyshev,
  gazeToward,
  isSafeCell,
  isStartCell,
  isStarCell,
  locationCell,
  tokenCell,
  type Cell,
  type DropState,
  type GameState,
  type PlayerColor,
  type SpecialTile,
  type TokenState,
} from '../engine'
import { ItemGlyph, StarGlyph } from './icons'
import { NutsPiece } from './NutsPiece'
import { PLAYER_THEME } from './theme'
import type { Vec2 } from '../../../components/met/character'

interface BoardProps {
  state: GameState
  hoppingId: string | null
  reducedMotion: boolean
  onSelectToken: (id: string) => void
}

export function Board({ state, hoppingId, reducedMotion, onSelectToken }: BoardProps) {
  const tiles = useMemo(() => buildTiles(), [])
  const tokens = state.players.flatMap((p) => p.tokens)
  const current = state.players[state.currentPlayerIndex]!

  return (
    <div className="ludo-board" aria-label="Ludo board">
      <div className="ludo-board-frame">
        {(Object.entries(HOME_YARD) as [PlayerColor, (typeof HOME_YARD)[PlayerColor]][]).map(([color, yard]) => {
          const theme = PLAYER_THEME[color]
          const player = state.players.find((p) => p.color === color)
          const active = current.color === color
          return (
            <div
              key={color}
              className={`ludo-yard ${active ? 'is-active' : ''} ${player ? '' : 'is-empty'}`}
              style={{
                left: pct(yard.x),
                top: pct(yard.y),
                width: pct(yard.size),
                height: pct(yard.size),
                ['--yard-accent' as string]: theme.accent,
                ['--yard-soft' as string]: theme.soft,
              }}
            >
              <div className="ludo-yard-pads">
                {[0, 1, 2, 3].map((slot) => (
                  <span key={slot} className="ludo-pad" />
                ))}
              </div>
              {player && <span className="ludo-yard-name">{player.name}</span>}
            </div>
          )
        })}

        <div className="ludo-hub" aria-hidden>
          <span data-arm="blue" />
          <span data-arm="yellow" />
          <span data-arm="green" />
          <span data-arm="red" />
          <span className="ludo-hub-star">
            <StarGlyph />
          </span>
        </div>

        {tiles.map((tile) => {
          const special = state.specialTiles.find((s) => cellKey(s.cell) === tile.key)
          const drop = state.drops.active.find((d) => cellKey(d.cell) === tile.key)
          return (
            <Tile
              key={tile.key}
              tile={tile}
              special={special}
              drop={drop}
            />
          )
        })}

        {tokens.map((token) => {
          const cell = tokenCell(token)
          const lookAt = gazeFor(token, tokens, state)
          const home = locationCell(token.color, { kind: 'home', slot: token.index }, token.index)
          return (
            <NutsPiece
              key={token.id}
              token={token}
              lookAt={lookAt}
              selected={state.selectedTokenId === token.id}
              selectable={state.legalTokenIds.includes(token.id)}
              hopping={hoppingId === token.id}
              reducedMotion={reducedMotion}
              onSelect={onSelectToken}
              style={{
                left: pct(cell.x + 0.5),
                top: pct(cell.y + 0.5),
                ['--home-x' as string]: pct(home.x + 0.5),
                ['--home-y' as string]: pct(home.y + 0.5),
                zIndex: 20 + token.index + (token.status === 'MOVING' ? 8 : 0),
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

interface TileInfo {
  key: string
  cell: Cell
  kind: 'path' | 'stretch'
  color?: PlayerColor
}

function buildTiles(): TileInfo[] {
  const tiles: TileInfo[] = MAIN_PATH.map((cell) => ({
    key: cellKey(cell),
    cell,
    kind: 'path' as const,
  }))
  ;(Object.entries(HOME_STRETCH) as [PlayerColor, Cell[]][]).forEach(([color, cells]) => {
    for (const cell of cells) {
      tiles.push({ key: cellKey(cell), cell, kind: 'stretch', color })
    }
  })
  return tiles
}

function Tile({
  tile,
  special,
  drop,
}: {
  tile: TileInfo
  special?: SpecialTile
  drop?: DropState
}) {
  const theme = tile.color ? PLAYER_THEME[tile.color] : null
  const start = isStartCell(tile.cell)
  const star = isStarCell(tile.cell)
  const safe = isSafeCell(tile.cell)
  const startColor = startColorOf(tile.cell)
  return (
    <div
      className={[
        'ludo-tile',
        tile.kind === 'stretch' ? 'is-stretch' : '',
        start ? 'is-start' : '',
        safe ? 'is-safe' : '',
        drop ? 'has-drop' : '',
      ].join(' ')}
      style={{
        left: pct(tile.cell.x),
        top: pct(tile.cell.y),
        width: pct(1),
        height: pct(1),
        ['--tile-accent' as string]: theme?.accent ?? (startColor ? PLAYER_THEME[startColor].accent : 'transparent'),
      }}
    >
      {star && !start && (
        <StarGlyph className="ludo-tile-star" />
      )}
      {special && !drop && (
        <span className="ludo-tile-special">
          <ItemGlyph type={special.kind} />
        </span>
      )}
      {drop && (
        <span className="ludo-drop-orb" data-type={drop.itemType}>
          <ItemGlyph type={drop.itemType} />
        </span>
      )}
    </div>
  )
}

function startColorOf(cell: Cell): PlayerColor | null {
  for (const color of ['blue', 'yellow', 'green', 'red'] as const) {
    const start = MAIN_PATH[START_INDEX[color]]!
    if (start.x === cell.x && start.y === cell.y) return color
  }
  return null
}

function gazeFor(token: TokenState, tokens: TokenState[], state: GameState): Vec2 | null {
  if (token.status === 'HOME_SLEEP' || token.status === 'HOME_IDLE') return { x: 0.15, y: 0.35 }
  if (token.status === 'RETURNING_HOME' || token.status === 'CAPTURED') return { x: 0, y: -0.4 }
  if (token.status === 'SELECTABLE') return { x: 0, y: 0.55 }
  if (token.status === 'WINNING') return { x: 0, y: -0.1 }

  const here = tokenCell(token)
  if (token.status === 'NEAR_ENEMY' || token.status === 'ATTACKING') {
    const enemy = tokens
      .filter((other) => other.color !== token.color && other.location.kind === 'track')
      .sort((a, b) => chebyshev(here, tokenCell(a)) - chebyshev(here, tokenCell(b)))[0]
    if (enemy) return gazeToward(here, tokenCell(enemy))
  }

  const drop = state.drops.active[0]
  if (drop && token.location.kind === 'track' && token.status === 'IDLE') {
    if (chebyshev(here, drop.cell) <= 4) return gazeToward(here, drop.cell)
  }

  if (token.status === 'MOVING' || token.status === 'ENTERING') return { x: 0, y: -0.15 }
  return null
}

function pct(n: number): string {
  return `${(n / 15) * 100}%`
}
