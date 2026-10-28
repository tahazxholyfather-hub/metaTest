/* eslint-disable react-refresh/only-export-components -- provider, hook, and button share one kit */
import { createContext, useContext, type ReactNode } from 'react'
import type { AudioManager } from '../audio'
import type { InputManager } from '../input'
import type { SaveManager } from '../save'
import type { Session } from '../session'

export interface BounceKit {
  session: Session
  audio: AudioManager
  input: InputManager
  save: SaveManager
}

const KitContext = createContext<BounceKit | null>(null)

export function KitProvider({ kit, children }: { kit: BounceKit; children: ReactNode }) {
  return <KitContext.Provider value={kit}>{children}</KitContext.Provider>
}

export function useBounce(): BounceKit {
  const kit = useContext(KitContext)
  if (!kit) throw new Error('Bounce UI mounted outside its provider')
  return kit
}

export function GameButton({
  children,
  onClick,
  kind = 'primary',
  disabled = false,
}: {
  children: ReactNode
  onClick: () => void
  kind?: 'primary' | 'soft' | 'ghost'
  disabled?: boolean
}) {
  const { audio } = useBounce()
  return (
    <button
      type="button"
      className={`b-btn b-btn-${kind}`}
      disabled={disabled}
      onClick={() => {
        audio.ui()
        onClick()
      }}
    >
      {children}
    </button>
  )
}
