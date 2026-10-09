import { useEffect, useRef, useState } from 'react'
import type Phaser from 'phaser'
import { getLevel } from '../levels'
import { AudioManager } from '../audio'
import { createGame } from '../game/createGame'
import { InputManager } from '../input'
import { SaveManager } from '../save'
import { Session, useSession } from '../session'
import { KitProvider } from './kit'
import { musicFor } from './music'
import { isPhonePortrait, wantsTouch } from './orient'
import {
  BootScreen,
  CompleteScreen,
  Hud,
  LevelSelectScreen,
  MenuScreen,
  PauseScreen,
  RotateScreen,
  SettingsScreen,
  TouchControls,
} from './screens'
import './bounce.css'

export function BounceApp() {
  const [kit] = useState(() => {
    const save = new SaveManager()
    const session = new Session(save)
    const audio = new AudioManager(save.settings)
    const input = new InputManager(save, () => session.phase === 'PLAYING')
    return { save, session, audio, input }
  })
  const snap = useSession(kit.session)
  const [portrait, setPortrait] = useState(() => isPhonePortrait())
  const [touch, setTouch] = useState(() => wantsTouch())
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    const { session, audio, input } = kit
    input.attach()
    const parent = document.getElementById('bounce-stage')
    const game = parent ? createGame(parent, { session, audio, input, save: kit.save }) : null
    gameRef.current = game
    session.boot()
    const prevTitle = document.title
    document.title = 'Bounce'
    document.body.classList.add('bounce-lock')
    const meta = document.querySelector('meta[name="viewport"]')
    const prevViewport = meta?.getAttribute('content') ?? ''
    if (meta && !prevViewport.includes('viewport-fit=cover')) {
      meta.setAttribute('content', `${prevViewport}, viewport-fit=cover`)
    }
    const unlock = () => audio.unlock()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault()
        session.onEscape()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('keydown', onKey)
      input.detach()
      audio.stopTheme()
      gameRef.current = null
      game?.destroy(true)
      document.title = prevTitle
      document.body.classList.remove('bounce-lock')
      if (meta) meta.setAttribute('content', prevViewport)
    }
  }, [kit])

  useEffect(() => {
    const apply = () => {
      const next = isPhonePortrait()
      setPortrait(next)
      setTouch(wantsTouch())
      kit.session.setRotate(next)
      gameRef.current?.scale.refresh()
    }
    apply()
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    return () => {
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
    }
  }, [kit])

  useEffect(() => {
    const theme = musicFor(snap.phase, snap.levelId)
    if (theme) kit.audio.playTheme(theme)
  }, [kit, snap.phase, snap.levelId])

  const levelTheme = snap.levelId ? getLevel(snap.levelId)?.theme : 'meadow'
  const playing = snap.phase === 'PLAYING'

  return (
    <KitProvider kit={kit}>
      <div className={portrait ? 'bounce-root is-portrait' : 'bounce-root'} dir="ltr" data-theme={levelTheme ?? 'meadow'}>
        <div className="bounce-stage" id="bounce-stage" />
        {playing && !portrait ? <Hud /> : null}
        {playing && touch && !portrait ? <TouchControls /> : null}
        {snap.phase === 'GAME_OVER' && !portrait ? <div className="b-toast">Bounced out</div> : null}
        {snap.phase === 'BOOT' ? <BootScreen label="Keep rolling." /> : null}
        {snap.phase === 'LOADING' ? <BootScreen label="Rolling in" /> : null}
        {snap.phase === 'MENU' && snap.panel === 'none' ? <MenuScreen /> : null}
        {snap.phase === 'LEVEL_SELECT' && snap.panel === 'none' ? <LevelSelectScreen /> : null}
        {snap.phase === 'PAUSED' && snap.panel === 'none' ? <PauseScreen /> : null}
        {snap.phase === 'LEVEL_COMPLETE' && snap.result && snap.panel === 'none' ? <CompleteScreen result={snap.result} /> : null}
        {snap.panel === 'settings' ? <SettingsScreen /> : null}
        {portrait ? <RotateScreen /> : null}
      </div>
    </KitProvider>
  )
}
