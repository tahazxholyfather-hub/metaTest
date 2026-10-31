import { useMemo, useState } from 'react'
import { useUser } from '../../context/UserContext'
import type { MatchSetup } from './engine'
import { Lobby } from './ui/Lobby'
import { LudoScreen } from './ui/LudoScreen'
import './ui/ludo.css'

export function LudoApp() {
  const { user } = useUser()
  const defaultName = useMemo(() => {
    const fromUser = user?.first_name || user?.username
    return fromUser || 'You'
  }, [user])
  const [setup, setSetup] = useState<MatchSetup | null>(null)

  return (
    <div className="ludo-root">
      {setup ? <LudoScreen setup={setup} onExit={() => setSetup(null)} /> : <Lobby defaultName={defaultName} onStart={setSetup} />}
    </div>
  )
}

export default LudoApp
