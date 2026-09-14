import '../styles.css'
import { ASSETS, preloadImages } from '../core/AssetManifest'
import { AudioManager } from '../core/AudioManager'
import { GameManager } from '../core/GameManager'
import { InputManager } from '../core/InputManager'
import { ProgressManager } from '../core/ProgressManager'
import { createSaveManager } from '../core/SaveManager'
import { bus } from '../core/events'
import type { LevelCompletePayload, LevelDef, SeasonDef } from '../core/types'
import { LEVEL_COUNT, SEASONS, nextLevel } from '../data/seasons'
import { CharacterEngine, drawCharacter, subscribeTicker } from '../character'
import { createPhaserGame } from '../game/createGame'
import type { Game as PhaserGame } from 'phaser'

const STUDIO = 'Quiet Orbit'
const TITLE = 'Gleam'

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (html !== undefined) n.innerHTML = html
  return n
}

function btn(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', cls, label)
  b.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  return b
}

export class App {
  private root: HTMLElement
  private save = createSaveManager()
  private progress: ProgressManager
  private audio: AudioManager
  private input = new InputManager()
  private gm: GameManager
  private game: PhaserGame | null = null
  private unsubs: Array<() => void> = []
  private touchVisible = false
  private nav = 0

  constructor(root: HTMLElement) {
    this.root = root
    this.progress = new ProgressManager(this.save)
    this.audio = new AudioManager(this.save.settings)
    this.gm = new GameManager(this.save, this.progress, this.audio, this.input)
    this.input.attach(window)
    this.progress.syncUnlocks()
    this.bindGlobal()
    const skipCinematic = !this.save.isFirstLaunch()
    if (skipCinematic) this.showLoading(true)
    else this.showLogo()
  }

  private bindGlobal(): void {
    const unlock = () => this.audio.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
  }

  private clear(): void {
    for (const u of this.unsubs) u()
    this.unsubs = []
    this.root.replaceChildren()
    this.root.className = ''
  }

  private showLogo(): void {
    this.clear()
    const id = this.begin()
    const s = el('div', 'screen logo-screen')
    const img = el('img', 'logo-mark')
    img.src = ASSETS.studioLogo
    img.alt = STUDIO
    const cap = el('div', 'logo-caption', STUDIO)
    s.append(img, cap)
    this.root.append(s)
    const skip = () => this.advance(id, () => this.showLoading(false))
    s.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip, { once: true })
    setTimeout(skip, 2600)
  }

  private advance(id: number, fn: () => void): void {
    if (this.nav !== id) return
    this.nav += 1
    fn()
  }

  private begin(): number {
    this.nav += 1
    return this.nav
  }

  private showLoading(quick: boolean): void {
    this.clear()
    const id = this.begin()
    const s = el('div', 'screen load-screen')
    const cover = el('img', 'load-cover')
    cover.src = ASSETS.cover
    cover.alt = TITLE
    const veil = el('div', 'load-veil')
    const copy = el('div', 'load-copy')
    copy.append(
      el('div', 'load-kicker', STUDIO),
      el('h1', '', TITLE),
      el('p', '', 'A bouncing adventure in four living worlds'),
    )
    const bar = el('div', 'load-bar')
    const fill = el('i')
    bar.append(fill)
    copy.append(bar)
    const skip = btn('Skip', 'load-skip', () => this.advance(id, () => this.showMenu()))
    skip.style.opacity = quick ? '1' : '0'
    s.append(cover, veil, copy, skip)
    this.root.append(s)

    const urls = [
      ASSETS.studioLogo,
      ASSETS.cover,
      ...Object.values(ASSETS.seasons),
      ...Object.values(ASSETS.backgrounds),
    ]
    const start = performance.now()
    void (async () => {
      await this.audio.unlock()
      await preloadImages(urls, (t) => {
        fill.style.width = `${Math.round(t * 100)}%`
      })
      fill.style.width = '100%'
      const wait = quick ? 280 : Math.max(0, 900 - (performance.now() - start))
      setTimeout(() => {
        skip.style.opacity = '1'
        this.save.markLaunchSeen()
        this.advance(id, () => this.showMenu())
      }, wait)
    })()
    this.audio.playMusic('menu')
  }

  private showMenu(): void {
    this.destroyGame()
    this.clear()
    this.audio.playMusic('menu')
    const s = el('div', 'screen paper')
    const hero = el('div', 'menu-hero')
    const canvas = el('canvas')
    canvas.width = 200
    canvas.height = 200
    hero.append(
      canvas,
      el('h1', '', TITLE),
      el('p', 'tag', 'Two eyes. Four seasons. Forty-four ways to bounce.'),
    )
    const actions = el('div', 'actions')
    const current = this.progress.currentLevel()
    actions.append(
      btn('Play', 'btn wide', () => this.showSeasons()),
      btn(this.save.getRecord(current.id)?.completed ? 'Continue' : 'Begin', 'btn ghost wide', () =>
        this.enterLevel(current),
      ),
      btn('Settings', 'btn ghost', () => this.showSettings(() => this.showMenu())),
    )
    s.append(hero, actions)
    this.root.append(s)
    this.runPortrait(canvas, 'idle')
  }

  private runPortrait(canvas: HTMLCanvasElement, state: 'idle' | 'happy' | 'curious'): () => void {
    const ctx = canvas.getContext('2d')!
    const engine = new CharacterEngine()
    engine.setState(state)
    engine.settle(0.6)
    const stop = subscribeTicker((dt) => {
      engine.update(dt)
      drawCharacter(ctx, engine, { destSize: canvas.width })
    })
    this.unsubs.push(stop)
    canvas.addEventListener('pointerdown', () => engine.poke())
    return stop
  }

  private showSeasons(): void {
    this.clear()
    this.audio.playMusic('menu')
    const s = el('div', 'screen paper season-wrap')
    const top = el('div', 'topbar')
    top.append(btn('←', 'icon-btn', () => this.showMenu()))
    const head = el('div')
    head.append(el('h2', '', 'Worlds'), el('p', 'sub', `${LEVEL_COUNT} stages across four seasons`))
    const rail = el('div', 'rail')
    for (const season of SEASONS) rail.append(this.seasonCard(season))
    s.append(top, head, rail)
    this.root.append(s)
    this.enableSwipe(rail)
  }

  private seasonCard(season: SeasonDef): HTMLElement {
    const unlocked = this.progress.isSeasonUnlocked(season)
    const prog = this.progress.seasonProgress(season)
    const card = el('article', `card${unlocked ? '' : ' locked'}`)
    const img = el('img')
    img.src = season.cover
    img.alt = season.name
    const body = el('div', 'body')
    body.append(
      el('h3', '', season.name),
      el('p', '', season.description),
      el(
        'div',
        'meta',
        `<span>${prog.completed}/${prog.total} levels</span><span>${prog.stars}/${prog.starMax} stars</span>`,
      ),
    )
    card.append(img, body)
    if (!unlocked) card.append(el('div', 'lock-pill', 'Locked'))
    card.addEventListener('click', () => {
      this.audio.playSfx('ui-click')
      if (!unlocked) return
      this.showLevelMap(season)
    })
    return card
  }

  private enableSwipe(rail: HTMLElement): void {
    let x = 0
    let sl = 0
    let down = false
    rail.addEventListener('pointerdown', (e) => {
      down = true
      x = e.clientX
      sl = rail.scrollLeft
      rail.setPointerCapture(e.pointerId)
    })
    rail.addEventListener('pointermove', (e) => {
      if (!down) return
      rail.scrollLeft = sl - (e.clientX - x)
    })
    rail.addEventListener('pointerup', () => (down = false))
  }

  private showLevelMap(season: SeasonDef): void {
    this.clear()
    const s = el('div', 'screen paper map-screen')
    const top = el('div', 'topbar')
    top.append(
      btn('←', 'icon-btn', () => this.showSeasons()),
      el('div', '', `<strong>${season.name}</strong>`),
    )
    const wrap = el('div', 'map-canvas-wrap')
    const canvas = el('canvas')
    wrap.append(canvas)
    const info = el('div', 'node-info')
    wrap.append(info)
    s.append(top, wrap)
    this.root.append(s)
    this.paintMap(canvas, wrap, season, info)
  }

  private paintMap(canvas: HTMLCanvasElement, wrap: HTMLElement, season: SeasonDef, info: HTMLElement): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      const r = wrap.getBoundingClientRect()
      canvas.width = Math.max(1, r.width * dpr)
      canvas.height = Math.max(1, r.height * dpr)
      draw()
    }
    const nodes = season.levels.map((l, i) => {
      const t = i / Math.max(1, season.levels.length - 1)
      return {
        level: l,
        x: 0.12 + t * 0.76,
        y: 0.28 + Math.sin(t * Math.PI * 3.1) * 0.22 + (l.isBoss ? -0.04 : 0),
      }
    })
    let selected = season.levels.find((l) => this.progress.isLevelUnlocked(l) && !this.save.getRecord(l.id)?.completed) ?? season.levels[0]!

    const draw = () => {
      const ctx = canvas.getContext('2d')!
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      const bg = new Image()
      bg.src = season.cover
      const paint = () => {
        ctx.globalAlpha = 0.35
        ctx.drawImage(bg, 0, 0, w, h)
        ctx.globalAlpha = 1
        const grd = ctx.createLinearGradient(0, 0, 0, h)
        grd.addColorStop(0, season.theme.skyTop + 'cc')
        grd.addColorStop(1, season.theme.skyBottom + 'ee')
        ctx.fillStyle = grd
        ctx.globalCompositeOperation = 'multiply'
        ctx.fillRect(0, 0, w, h)
        ctx.globalCompositeOperation = 'source-over'
        ctx.lineWidth = 6 * dpr
        ctx.strokeStyle = 'rgba(22,19,15,0.28)'
        ctx.beginPath()
        nodes.forEach((n, i) => {
          const x = n.x * w
          const y = n.y * h
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()
        for (const n of nodes) {
          const x = n.x * w
          const y = n.y * h
          const unlocked = this.progress.isLevelUnlocked(n.level)
          const rec = this.save.getRecord(n.level.id)
          const sel = n.level.id === selected.id
          ctx.beginPath()
          ctx.arc(x, y, (n.level.isBoss ? 22 : 16) * dpr, 0, Math.PI * 2)
          ctx.fillStyle = !unlocked ? '#b9b09f' : n.level.isBoss ? '#16130f' : rec?.completed ? '#2f6a3a' : '#f7f1e8'
          ctx.fill()
          ctx.lineWidth = (sel ? 5 : 2) * dpr
          ctx.strokeStyle = sel ? '#c9a227' : 'rgba(22,19,15,0.45)'
          ctx.stroke()
          ctx.fillStyle = n.level.isBoss || rec?.completed ? '#f7f1e8' : '#16130f'
          ctx.font = `${12 * dpr}px Outfit, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(n.level.isBoss ? 'B' : String(n.level.index), x, y)
          if (rec && rec.stars) {
            ctx.fillStyle = '#c9a227'
            ctx.font = `${10 * dpr}px sans-serif`
            ctx.fillText('★'.repeat(rec.stars), x, y + 26 * dpr)
          }
        }
      }
      if (bg.complete) paint()
      else bg.onload = paint
    }

    const pick = (cx: number, cy: number) => {
      const r = canvas.getBoundingClientRect()
      const x = ((cx - r.left) / r.width) * canvas.width
      const y = ((cy - r.top) / r.height) * canvas.height
      let best = selected
      let bestD = Infinity
      for (const n of nodes) {
        const dx = n.x * canvas.width - x
        const dy = n.y * canvas.height - y
        const d = dx * dx + dy * dy
        if (d < bestD) {
          bestD = d
          best = n.level
        }
      }
      selected = best
      renderInfo()
      draw()
    }

    const renderInfo = () => {
      const unlocked = this.progress.isLevelUnlocked(selected)
      const rec = this.save.getRecord(selected.id)
      info.replaceChildren()
      const left = el('div')
      left.append(
        el('strong', '', `${selected.isBoss ? 'Boss · ' : `Level ${selected.index} · `}${selected.name}`),
        el('div', '', selected.subtitle ?? selected.archetype),
        el('div', 'stars', rec ? '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars) : '☆☆☆'),
      )
      const go = btn(unlocked ? 'Enter' : 'Locked', 'btn', () => {
        if (!unlocked) return
        this.audio.playSfx('whoosh')
        this.enterLevel(selected)
      })
      if (!unlocked) go.disabled = true
      info.append(left, go)
    }

    canvas.addEventListener('pointerdown', (e) => pick(e.clientX, e.clientY))
    window.addEventListener('resize', resize)
    this.unsubs.push(() => window.removeEventListener('resize', resize))
    resize()
    renderInfo()
  }

  private enterLevel(level: LevelDef): void {
    const season = this.gm.seasonOf(level)
    this.save.setLastPlayed(season.id, level.id)
    this.clear()
    const root = el('div', 'play-root')
    const phaser = el('div')
    phaser.id = 'phaser'
    const hud = el('div', 'hud')
    const left = el('div', 'pill', '0')
    left.id = 'hud-left'
    const pause = btn('II', '', () => bus.emit('pause', { paused: true }))
    hud.append(left, pause)
    const touch = this.buildTouch()
    const overlays = el('div')
    overlays.id = 'overlays'
    root.append(phaser, hud, touch, overlays)
    this.root.append(root)
    this.touchVisible = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900
    touch.style.display = this.touchVisible ? 'flex' : 'none'

    this.game = createPhaserGame(phaser, {
      level,
      season,
      audio: this.audio,
      input: this.input,
      save: this.save,
      progress: this.progress,
      settings: this.save.settings,
    })

    this.unsubs.push(
      bus.on('hud', (h) => {
        const t = `${Math.floor(h.time / 60)}:${String(Math.floor(h.time % 60)).padStart(2, '0')}`
        left.innerHTML = `<b>${h.score}</b> · ${t} · ${h.collected}/${h.collectMax} · ★${h.starsPreview}`
      }),
      bus.on('pause', (p) => {
        if (p.paused) this.showPause(level, season)
        else this.closeOverlay()
      }),
      bus.on('complete', (p) => this.showComplete(p)),
      bus.on('exit-level', () => {
        this.destroyGame()
        this.showLevelMap(season)
      }),
      bus.on('next-level', () => {
        const n = nextLevel(level.id)
        this.destroyGame()
        if (n) this.enterLevel(n)
        else this.showLevelMap(season)
      }),
      bus.on('restart', () => {
        this.closeOverlay()
      }),
    )
  }

  private buildTouch(): HTMLElement {
    const wrap = el('div', `touch${this.save.settings.leftHanded ? ' righty' : ''}`)
    const pad = el('div', 'pad')
    const jump = el('div', 'jump')
    const mk = (label: string, action: 'left' | 'right' | 'jump') => {
      const b = el('button', 'tbtn', label)
      const on = (e: Event) => {
        e.preventDefault()
        this.input.setTouch(action, true)
        b.classList.add('held')
      }
      const off = (e: Event) => {
        e.preventDefault()
        this.input.setTouch(action, false)
        b.classList.remove('held')
      }
      b.addEventListener('pointerdown', on)
      b.addEventListener('pointerup', off)
      b.addEventListener('pointercancel', off)
      b.addEventListener('pointerleave', off)
      return b
    }
    pad.append(mk('◀', 'left'), mk('▶', 'right'))
    jump.append(mk('▲', 'jump'))
    wrap.append(pad, jump)
    return wrap
  }

  private overlay(): HTMLElement {
    this.closeOverlay()
    const layer = el('div', 'modal-layer')
    layer.id = 'modal'
    this.root.querySelector('#overlays')?.append(layer)
    return layer
  }

  private closeOverlay(): void {
    this.root.querySelector('#modal')?.remove()
  }

  private showPause(level: LevelDef, season: SeasonDef): void {
    const layer = this.overlay()
    const sheet = el('div', 'sheet')
    sheet.append(el('h2', '', 'Paused'), el('p', '', level.name))
    const actions = el('div', 'actions')
    actions.append(
      btn('Resume', 'btn', () => bus.emit('pause', { paused: false })),
      btn('Restart', 'btn ghost', () => {
        bus.emit('pause', { paused: false })
        bus.emit('restart', undefined)
      }),
      btn('Settings', 'btn ghost', () => this.showSettings(() => this.showPause(level, season))),
      btn('Exit', 'btn ghost', () => bus.emit('exit-level', undefined)),
    )
    sheet.append(actions)
    layer.append(sheet)
  }

  private showComplete(p: LevelCompletePayload): void {
    const layer = this.overlay()
    const sheet = el('div', 'sheet')
    sheet.append(
      el('h2', '', p.level.isBoss ? 'Guardian Down' : 'Cleared'),
      el('div', 'stars', '★'.repeat(p.stars) + '☆'.repeat(3 - p.stars)),
    )
    const rows = el('div', 'rows')
    const s = p.stats
    const line = (k: string, v: string) => rows.append(Object.assign(el('div'), { innerHTML: `<span>${k}</span><b>${v}</b>` }))
    line('Score', String(s.score) + (p.newBestScore ? ' · best' : ''))
    line('Time', `${s.time.toFixed(1)}s` + (p.newBestTime ? ' · best' : ''))
    line('Deaths', String(s.deaths))
    line('Collectibles', `${s.collectibles}/${s.collectiblesMax}`)
    line('Secrets', `${s.secrets}/${s.secretsMax}`)
    if (p.unlockedSeason) {
      const ns = SEASONS.find((x) => x.id === p.unlockedSeason)
      line('Unlocked', ns?.name ?? 'New season')
    }
    const actions = el('div', 'actions')
    actions.append(
      btn('Replay', 'btn ghost', () => {
        this.closeOverlay()
        bus.emit('restart', undefined)
      }),
      btn(p.unlockedNext ? 'Next' : 'Map', 'btn', () => {
        if (p.unlockedNext) bus.emit('next-level', undefined)
        else bus.emit('exit-level', undefined)
      }),
      btn('Level select', 'btn ghost', () => bus.emit('exit-level', undefined)),
    )
    sheet.append(rows, actions)
    layer.append(sheet)
  }

  private showSettings(back: () => void): void {
    const host = this.root.querySelector('#overlays') ? this.overlay() : this.root
    if (!this.root.querySelector('#overlays')) this.clear()
    const sheet = el('div', host === this.root ? 'screen paper' : 'sheet')
    if (host === this.root) {
      const inner = el('div', 'sheet')
      this.fillSettings(inner, back)
      sheet.append(inner)
      this.root.append(sheet)
      return
    }
    this.fillSettings(sheet, back)
    host.append(sheet)
  }

  private fillSettings(sheet: HTMLElement, back: () => void): void {
    const st = this.save.settings
    sheet.append(el('h2', '', 'Settings'))
    const row = (label: string, control: HTMLElement) => {
      const r = el('div', 'settings-row')
      r.append(el('span', '', label), control)
      sheet.append(r)
    }
    const slider = (key: 'master' | 'music' | 'sfx', val: number) => {
      const i = el('input')
      i.type = 'range'
      i.min = '0'
      i.max = '1'
      i.step = '0.01'
      i.value = String(val)
      i.addEventListener('input', () => {
        this.save.patchSettings({ [key]: Number(i.value) })
        this.audio.applySettings(this.save.settings)
      })
      return i
    }
    row('Master', slider('master', st.master))
    row('Music', slider('music', st.music))
    row('Sound', slider('sfx', st.sfx))
    const mkToggle = (key: 'muted' | 'shake' | 'particles' | 'leftHanded', on: boolean) => {
      const i = el('input')
      i.type = 'checkbox'
      i.checked = on
      i.addEventListener('change', () => {
        this.save.patchSettings({ [key]: i.checked })
        this.audio.applySettings(this.save.settings)
      })
      return i
    }
    row('Mute', mkToggle('muted', st.muted))
    row('Screen shake', mkToggle('shake', st.shake))
    row('Particles', mkToggle('particles', st.particles))
    row('Left-handed touch', mkToggle('leftHanded', st.leftHanded))
    const actions = el('div', 'actions')
    actions.append(
      btn('Done', 'btn', back),
      btn('Reset progress', 'btn ghost', () => {
        this.save.resetProgress()
        this.progress.syncUnlocks()
        back()
      }),
    )
    sheet.append(actions)
  }

  private destroyGame(): void {
    if (this.game) {
      this.game.destroy(true)
      this.game = null
    }
    this.input.setTouch('left', false)
    this.input.setTouch('right', false)
    this.input.setTouch('jump', false)
  }
}
