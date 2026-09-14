import { TILE, type CollectibleDef, type EnemyDef, type EnemyKind, type HazardDef, type LevelArchetype, type LevelDef, type PlatformDef, type PlatformType, type PortalDef, type SecretRoomDef, type ZoneDef } from '../../core/types'

export interface MapExtras {
  tile?: number
  parTime?: number
  subtitle?: string
  intro?: string
  easterEgg?: string
  sky?: number
  movers?: Record<string, { dx: number; dy: number; period: number; phase?: number; type?: PlatformType }>
  lasers?: Record<string, { w: number; h: number; onMs?: number; offMs?: number; delay?: number }>
  crushers?: Record<string, { dx: number; dy: number; period: number; phase?: number; w?: number; h?: number }>
  portals?: Record<string, { pair: string; rotate?: number }>
  zones?: { x: number; y: number; w: number; h: number; gravity?: ZoneDef['gravity']; fluid?: boolean; toxic?: boolean; sticky?: boolean }[]
  secrets?: SecretRoomDef[]
  boss?: LevelDef['boss']
  goal?: { x: number; y: number; w: number; h: number }
  decorations?: LevelDef['decorations']
}

const ENEMY_KIND: Record<string, EnemyKind> = {
  e: 'patrol',
  w: 'walker',
  j: 'jumper',
  f: 'flyer',
  h: 'shooter',
  x: 'chaser',
  d: 'shielded',
  n: 'environmental',
}

const SOLID: Record<string, PlatformType> = {
  '#': 'solid',
  '=': 'oneway',
  '~': 'sticky',
  C: 'crumble',
  t: 'timed',
  H: 'hidden',
  I: 'ice',
}

function trimMap(raw: string): string[] {
  const lines = raw.replace(/^\n/, '').replace(/\n$/, '').split('\n')
  const width = Math.max(...lines.map((l) => l.length))
  return lines.map((l) => l.padEnd(width, '.'))
}

function greedyRects(grid: boolean[][], cols: number, rows: number): { x: number; y: number; w: number; h: number }[] {
  const seen = grid.map((row) => row.map(() => false))
  const rects: { x: number; y: number; w: number; h: number }[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!grid[y]![x] || seen[y]![x]) continue
      let w = 1
      while (x + w < cols && grid[y]![x + w] && !seen[y]![x + w]) w++
      let h = 1
      outer: while (y + h < rows) {
        for (let i = 0; i < w; i++) {
          if (!grid[y + h]![x + i] || seen[y + h]![x + i]) break outer
        }
        h++
      }
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) seen[yy]![xx] = true
      rects.push({ x, y, w, h })
    }
  }
  return rects
}

export function compileLevel(
  seasonId: string,
  index: number,
  name: string,
  archetype: LevelArchetype,
  mapRaw: string,
  extras: MapExtras = {},
): LevelDef {
  const tile = extras.tile ?? TILE
  const sky = extras.sky ?? (archetype === 'vertical' ? 2 : 10)
  const trimmed = trimMap(mapRaw)
  const cols = trimmed[0]?.length ?? 0
  const pad = Array.from({ length: sky }, () => '.'.repeat(cols))
  const rows = [...pad, ...trimmed]
  const height = rows.length
  const platforms: PlatformDef[] = []
  const hazards: HazardDef[] = []
  const enemies: EnemyDef[] = []
  const collectibles: CollectibleDef[] = []
  const checkpoints: LevelDef['checkpoints'] = []
  const portals: PortalDef[] = []
  const zones: ZoneDef[] = extras.zones?.map((z) => ({ ...z })) ?? []
  let spawn = { x: tile * 2, y: tile * 2 }
  let goal = extras.goal ?? { x: (cols - 3) * tile, y: tile, w: tile * 2, h: tile * 2 }

  const solidKinds = new Map<PlatformType, boolean[][]>()
  const ensure = (t: PlatformType) => {
    let g = solidKinds.get(t)
    if (!g) {
      g = Array.from({ length: height }, () => Array(cols).fill(false))
      solidKinds.set(t, g)
    }
    return g
  }

  const portalChars = extras.portals ?? {}
  const moverChars = extras.movers ?? {}
  const laserChars = extras.lasers ?? {}
  const crusherChars = extras.crushers ?? {}

  for (let y = 0; y < height; y++) {
    const row = rows[y]!
    for (let x = 0; x < cols; x++) {
      const ch = row[x] ?? '.'
      const cx = x * tile + tile / 2
      const cy = y * tile + tile / 2
      if (ch === '.' || ch === ' ') continue
      if (SOLID[ch]) {
        ensure(SOLID[ch]!)[y]![x] = true
        continue
      }
      if (ch === '>') {
        platforms.push({ x: x * tile, y: y * tile, w: tile, h: tile, type: 'conveyor', dir: 1, speed: 140 })
        continue
      }
      if (ch === '<') {
        platforms.push({ x: x * tile, y: y * tile, w: tile, h: tile, type: 'conveyor', dir: -1, speed: 140 })
        continue
      }
      if (ch === '^') {
        platforms.push({ x: x * tile, y: y * tile + tile * 0.45, w: tile, h: tile * 0.55, type: 'spring', spring: 920 })
        continue
      }
      if (ch === '!') {
        hazards.push({ x: x * tile + 4, y: y * tile + tile * 0.45, w: tile - 8, h: tile * 0.55, type: 'spike' })
        continue
      }
      if (ch === 'T') {
        hazards.push({ x: x * tile, y: y * tile, w: tile, h: tile, type: 'toxic' })
        continue
      }
      if (ch === 'Q') {
        hazards.push({ x: x * tile, y: y * tile, w: tile * 1.4, h: tile * 1.4, type: 'gear' })
        continue
      }
      if (ch === 'P') {
        spawn = { x: cx, y: cy }
        continue
      }
      if (ch === 'G') {
        goal = { x: x * tile - tile, y: y * tile - tile * 1.5, w: tile * 3, h: tile * 3 }
        continue
      }
      if (ch === 'o') {
        collectibles.push({ x: cx, y: cy, rarity: 'common' })
        continue
      }
      if (ch === '*') {
        collectibles.push({ x: cx, y: cy, rarity: 'rare' })
        continue
      }
      if (ch === '?') {
        collectibles.push({ x: cx, y: cy, rarity: 'secret', id: `secret-${x}-${y}` })
        continue
      }
      if (ch === '+') {
        checkpoints.push({ x: cx, y: cy, id: `cp-${x}-${y}` })
        continue
      }
      if (ENEMY_KIND[ch]) {
        enemies.push({ x: cx, y: cy, kind: ENEMY_KIND[ch]!, patrol: 80 })
        continue
      }
      if (moverChars[ch]) {
        const m = moverChars[ch]!
        platforms.push({
          x: x * tile,
          y: y * tile,
          w: tile * 2,
          h: tile * 0.55,
          type: m.type ?? 'moving',
          move: { dx: m.dx, dy: m.dy, period: m.period, phase: m.phase },
        })
        continue
      }
      if (laserChars[ch]) {
        const l = laserChars[ch]!
        hazards.push({
          x: x * tile,
          y: y * tile,
          w: l.w,
          h: l.h,
          type: 'laser',
          onMs: l.onMs ?? 900,
          offMs: l.offMs ?? 900,
          delay: l.delay ?? 0,
        })
        continue
      }
      if (crusherChars[ch]) {
        const c = crusherChars[ch]!
        hazards.push({
          x: x * tile,
          y: y * tile,
          w: (c.w ?? 2) * tile,
          h: (c.h ?? 1) * tile,
          type: 'crusher',
          move: { dx: c.dx, dy: c.dy, period: c.period, phase: c.phase },
        })
        continue
      }
      if (portalChars[ch]) {
        const p = portalChars[ch]!
        portals.push({
          id: `p-${ch}-${x}-${y}`,
          x: x * tile,
          y: y * tile,
          w: tile,
          h: tile * 1.4,
          targetId: p.pair,
          rotate: p.rotate,
          retainVelocity: true,
        })
        continue
      }
    }
  }

  for (const [type, grid] of solidKinds) {
    for (const r of greedyRects(grid, cols, height)) {
      platforms.push({
        x: r.x * tile,
        y: r.y * tile,
        w: r.w * tile,
        h: r.h * tile,
        type,
        period: type === 'timed' ? 2.2 : undefined,
        visible: type !== 'hidden',
      })
    }
  }

  // Link portal pairs by extras.pair matching the other char's id prefix
  if (portals.length) {
    const byChar = new Map<string, PortalDef[]>()
    for (const p of portals) {
      const ch = p.id.split('-')[1] ?? ''
      const list = byChar.get(ch) ?? []
      list.push(p)
      byChar.set(ch, list)
    }
    for (const p of portals) {
      const ch = p.id.split('-')[1] ?? ''
      const pairChar = portalChars[ch]?.pair
      if (!pairChar) continue
      const targets = byChar.get(pairChar)
      const target = targets?.[0]
      if (target) p.targetId = target.id
    }
  }

  const secretCollects = collectibles.filter((c) => c.rarity === 'secret').length
  const width = cols * tile
  const worldH = height * tile

  return {
    id: `${seasonId.replace('season-', 's')}-l${String(index).padStart(2, '0')}`,
    seasonId,
    index,
    name,
    subtitle: extras.subtitle,
    archetype,
    isBoss: archetype === 'boss',
    parTime: extras.parTime ?? Math.max(20, Math.round(width / 90 + height / 40)),
    tile,
    width,
    height: worldH,
    spawn,
    goal,
    platforms,
    hazards,
    enemies,
    collectibles,
    checkpoints,
    portals,
    zones,
    secrets: extras.secrets ?? (secretCollects ? [{ id: 'hidden', x: 0, y: 0, w: 0, h: 0 }] : []),
    decorations: extras.decorations ?? [],
    boss: extras.boss
      ? { ...extras.boss, y: extras.boss.y + sky * tile }
      : extras.boss,
    intro: extras.intro,
    easterEgg: extras.easterEgg,
  }
}

export function bossLevel(
  seasonId: string,
  name: string,
  mapRaw: string,
  extras: MapExtras,
): LevelDef {
  const def = compileLevel(seasonId, 11, name, 'boss', mapRaw, extras)
  return def
}
