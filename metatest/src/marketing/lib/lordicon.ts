type LordPlayer = HTMLElement & {
  playFromBeginning?: () => void;
  play?: () => void;
  playerInstance?: {
    playFromBeginning?: () => void;
    play?: () => void;
    state?: { player?: { play?: () => void } };
  };
};

export function playLordIcon(icon: Element) {
  const el = icon as LordPlayer;
  const tryPlay = () => {
    try {
      if (typeof el.playFromBeginning === 'function') el.playFromBeginning();
      else if (el.playerInstance && typeof el.playerInstance.playFromBeginning === 'function') el.playerInstance.playFromBeginning();
      else if (typeof el.play === 'function') el.play();
      else if (el.playerInstance && typeof el.playerInstance.play === 'function') el.playerInstance.play();
      else if (el.playerInstance?.state?.player) el.playerInstance.state.player.play?.();
    } catch (error) {
      console.warn('Lordicon play failed:', error);
    }
  };

  if (el.playerInstance) {
    tryPlay();
    return;
  }
  const readyHandler = () => {
    window.setTimeout(tryPlay, 100);
    el.removeEventListener('ready', readyHandler);
  };
  el.addEventListener('ready', readyHandler);
  window.setTimeout(tryPlay, 300);
}
