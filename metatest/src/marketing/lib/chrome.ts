export function startChrome(): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.js-soon')) {
      event.preventDefault();
      document.getElementById('soon-modal')?.classList.add('open');
      return;
    }
    if (target.closest('#soon-close')) {
      document.getElementById('soon-modal')?.classList.remove('open');
      return;
    }
    if (target.id === 'soon-modal') target.classList.remove('open');
  };
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
