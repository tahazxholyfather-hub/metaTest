import { playLordIcon } from './lordicon';
import { SVG_LIB } from './scienceSvgs';

type SymbolCfg = {
  svg: keyof typeof SVG_LIB | string;
  layer: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  factor: number;
  rotSpeed: number;
  phase: number;
};

const SYMBOLS: SymbolCfg[] = [
  { svg: 'atom', layer: 1, x: 5, y: 5, scale: 4.5, opacity: 0.04, factor: 0.5, rotSpeed: 0.6, phase: 0 },
  { svg: 'molecule', layer: 1, x: 85, y: 7, scale: 4.0, opacity: 0.04, factor: 0.48, rotSpeed: -0.5, phase: 2 },
  { svg: 'cell', layer: 1, x: 78, y: 15, scale: 4.2, opacity: 0.05, factor: 0.45, rotSpeed: 0.7, phase: 4 },
  { svg: 'wave', layer: 1, x: 10, y: 14, scale: 4.0, opacity: 0.05, factor: 0.46, rotSpeed: -0.6, phase: 6 },
  { svg: 'helix', layer: 2, x: 8, y: 28, scale: 3.2, opacity: 0.07, factor: 0.38, rotSpeed: -0.8, phase: 1 },
  { svg: 'pendulum', layer: 2, x: 88, y: 30, scale: 3.0, opacity: 0.07, factor: 0.36, rotSpeed: 0.7, phase: 5 },
  { svg: 'flask', layer: 2, x: 82, y: 42, scale: 3.1, opacity: 0.08, factor: 0.35, rotSpeed: -0.9, phase: 7 },
  { svg: 'benzene', layer: 2, x: 15, y: 40, scale: 3.0, opacity: 0.08, factor: 0.37, rotSpeed: 0.8, phase: 9 },
  { svg: 'brain', layer: 3, x: 75, y: 52, scale: 2.6, opacity: 0.11, factor: 0.3, rotSpeed: 0.75, phase: 8 },
  { svg: 'magnet', layer: 3, x: 20, y: 55, scale: 2.5, opacity: 0.11, factor: 0.28, rotSpeed: -1.0, phase: 4 },
  { svg: 'microscope', layer: 3, x: 10, y: 65, scale: 2.4, opacity: 0.12, factor: 0.26, rotSpeed: -0.6, phase: 6 },
  { svg: 'prism', layer: 3, x: 85, y: 68, scale: 2.5, opacity: 0.12, factor: 0.27, rotSpeed: 1.1, phase: 3 },
  { svg: 'testTube', layer: 3, x: 25, y: 70, scale: 2.3, opacity: 0.12, factor: 0.25, rotSpeed: -1.2, phase: 9 },
  { svg: 'chromosome', layer: 3, x: 80, y: 75, scale: 2.4, opacity: 0.12, factor: 0.26, rotSpeed: 0.85, phase: 5 },
  { svg: 'leaf', layer: 4, x: 12, y: 82, scale: 1.8, opacity: 0.15, factor: 0.2, rotSpeed: -1.4, phase: 5 },
  { svg: 'gravity', layer: 4, x: 30, y: 84, scale: 1.7, opacity: 0.15, factor: 0.18, rotSpeed: 1.2, phase: 2 },
  { svg: 'beaker', layer: 4, x: 75, y: 86, scale: 1.8, opacity: 0.16, factor: 0.19, rotSpeed: -1.5, phase: 7 },
  { svg: 'orbit', layer: 4, x: 88, y: 88, scale: 1.7, opacity: 0.16, factor: 0.18, rotSpeed: 1.3, phase: 1 },
];

export function startScienceField(root: HTMLElement): () => void {
  const world = root.querySelector<HTMLElement>('#depth-world');
  const symbolEls: { el: HTMLElement; cfg: SymbolCfg }[] = [];
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMobile = window.innerWidth <= 900 || isIOS;
  if (!world) return () => undefined;

  SYMBOLS.forEach((raw) => {
    const cfg = isMobile
      ? { ...raw, scale: Math.min(raw.scale * 0.7, 2.6), opacity: Math.min(raw.opacity * 1.25, 0.36) }
      : raw;
    const el = document.createElement('div');
    el.className = 'symbol';
    const size = 80 * cfg.scale;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    let x = cfg.x;
    if (isMobile) {
      const widthPct = (size / Math.max(window.innerWidth, 1)) * 100;
      x = Math.min(Math.max(x, 1), Math.max(1, 97 - widthPct));
    }
    el.style.left = `${x}%`;
    el.style.top = `${cfg.y}%`;
    el.style.opacity = String(cfg.opacity);
    el.style.zIndex = String(cfg.layer);
    el.innerHTML = SVG_LIB[cfg.svg] || '';
    world.appendChild(el);
    symbolEls.push({ el, cfg });
  });

  const rotMul = isIOS ? 0.09 : 0.14;
  const nSymbols = symbolEls.length;
  let lastY = -1;
  let live = false;
  let idleFrames = 0;
  let frame = 0;
  let alive = true;

  function applySymbols(y: number) {
    for (let i = 0; i < nSymbols; i += 1) {
      const { el, cfg } = symbolEls[i];
      const yo = y * cfg.factor;
      const xo = Math.sin(y * 0.0022 + cfg.phase) * (58 * cfg.factor);
      const rot = y * cfg.rotSpeed * rotMul;
      el.style.transform = `translate3d(${xo}px,${yo}px,0) rotate(${rot}deg)`;
    }
  }

  function kickSymbols() {
    if (!alive || prefersReduced) return;
    idleFrames = 0;
    if (!live) {
      live = true;
      frame = requestAnimationFrame(tick);
    }
  }

  function tick() {
    if (!alive) return;
    const y = window.scrollY;
    if (y !== lastY) {
      lastY = y;
      applySymbols(y);
      idleFrames = 0;
    } else {
      idleFrames += 1;
    }
    if (idleFrames < 120) frame = requestAnimationFrame(tick);
    else live = false;
  }

  const onScroll = () => kickSymbols();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', kickSymbols, { passive: true });
  if (!prefersReduced) {
    applySymbols(window.scrollY || 0);
    kickSymbols();
  }

  return () => {
    alive = false;
    live = false;
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', kickSymbols);
    symbolEls.forEach(({ el }) => el.remove());
  };
}

export function startHomeStage(root: HTMLElement): () => void {
  const world = root.querySelector<HTMLElement>('#depth-world');
  const backToTop = root.querySelector<HTMLElement>('#back-to-top');
  const symbolEls: { el: HTMLElement; cfg: SymbolCfg }[] = [];
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMobile = window.innerWidth <= 900 || isIOS;
  if (isIOS) document.documentElement.classList.add('is-ios');

  if (world) {
    SYMBOLS.forEach((raw) => {
      const cfg = isMobile
        ? { ...raw, scale: Math.min(raw.scale * 0.7, 2.6), opacity: Math.min(raw.opacity * 1.25, 0.36) }
        : raw;
      const el = document.createElement('div');
      el.className = 'symbol';
      const size = 80 * cfg.scale;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      let x = cfg.x;
      if (isMobile) {
        const widthPct = (size / Math.max(window.innerWidth, 1)) * 100;
        x = Math.min(Math.max(x, 1), Math.max(1, 97 - widthPct));
      }
      el.style.left = `${x}%`;
      el.style.top = `${cfg.y}%`;
      el.style.opacity = String(cfg.opacity);
      el.style.zIndex = String(cfg.layer);
      el.innerHTML = SVG_LIB[cfg.svg] || '';
      world.appendChild(el);
      symbolEls.push({ el, cfg });
    });
  }

  const rotMul = isIOS ? 0.09 : 0.14;
  const nSymbols = symbolEls.length;
  let lastY = -1;
  let live = false;
  let idleFrames = 0;
  let frame = 0;
  let alive = true;

  function applySymbols(y: number) {
    for (let i = 0; i < nSymbols; i += 1) {
      const { el, cfg } = symbolEls[i];
      const yo = y * cfg.factor;
      const xo = Math.sin(y * 0.0022 + cfg.phase) * (58 * cfg.factor);
      const rot = y * cfg.rotSpeed * rotMul;
      el.style.transform = `translate3d(${xo}px,${yo}px,0) rotate(${rot}deg)`;
    }
  }

  function tick() {
    if (!alive) return;
    const y = window.scrollY;
    if (y !== lastY) {
      lastY = y;
      applySymbols(y);
      idleFrames = 0;
    } else {
      idleFrames += 1;
    }
    if (idleFrames < 120) frame = requestAnimationFrame(tick);
    else live = false;
  }

  function kickSymbols() {
    if (!alive || prefersReduced) return;
    idleFrames = 0;
    if (!live) {
      live = true;
      frame = requestAnimationFrame(tick);
    }
  }

  const onScroll = () => {
    backToTop?.classList.toggle('show', window.scrollY > 600);
    kickSymbols();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', kickSymbols, { passive: true });
  window.addEventListener('load', kickSymbols);
  if (!prefersReduced) {
    applySymbols(window.scrollY || 0);
    kickSymbols();
  }
  backToTop?.classList.toggle('show', window.scrollY > 600);

  const observers: IntersectionObserver[] = [];
  if ('IntersectionObserver' in window) {
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        const icon = entry.target.querySelector('lord-icon');
        if (icon) playLordIcon(icon);
        revealObs.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    root.querySelectorAll('.aww-section, .reveal-section').forEach((el) => revealObs.observe(el));
    observers.push(revealObs);

    const iconObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const icon = entry.target.querySelector('lord-icon');
        if (!icon) return;
        if (entry.isIntersecting) playLordIcon(icon);
      });
    }, { threshold: 0.45 });
    root.querySelectorAll('.slide-icon-wrap').forEach((el) => iconObs.observe(el));
    observers.push(iconObs);

    const marqueeObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const track = entry.target as HTMLElement;
        track.style.animationPlayState = entry.isIntersecting ? 'running' : 'paused';
      });
    }, { rootMargin: '80px 0px' });
    root.querySelectorAll<HTMLElement>('.marquee-track').forEach((el) => {
      el.style.animationPlayState = 'paused';
      marqueeObs.observe(el);
    });
    observers.push(marqueeObs);
  } else {
    root.querySelectorAll('.aww-section, .reveal-section').forEach((el) => el.classList.add('is-visible'));
  }

  const slides = [...root.querySelectorAll<HTMLElement>('.slide')];
  const dots = [...root.querySelectorAll<HTMLElement>('.dot')];
  let currentSlide = 0;
  let slideTimer = 0;
  const leavingTimers = new Set<number>();

  function goToSlide(index: number) {
    if (!alive || !slides.length || index === currentSlide) return;
    slides[currentSlide].classList.remove('active');
    slides[currentSlide].classList.add('leaving');
    const leavingTimer = window.setTimeout(() => {
      leavingTimers.delete(leavingTimer);
      if (!alive) return;
      slides[currentSlide]?.classList.remove('leaving');
    }, 700);
    leavingTimers.add(leavingTimer);
    currentSlide = index;
    slides[currentSlide].classList.add('active');
    dots.forEach((dot, i) => dot.classList.toggle('active', i === currentSlide));
  }

  function nextSlide() {
    if (!slides.length) return;
    goToSlide((currentSlide + 1) % slides.length);
  }

  const dotClicks = dots.map((dot) => {
    const onClick = () => {
      window.clearInterval(slideTimer);
      goToSlide(Number(dot.dataset.index));
      slideTimer = window.setInterval(nextSlide, 5000);
    };
    dot.addEventListener('click', onClick);
    return () => dot.removeEventListener('click', onClick);
  });
  if (slides.length) slideTimer = window.setInterval(nextSlide, 5000);

  const onTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  backToTop?.addEventListener('click', onTop);

  return () => {
    alive = false;
    live = false;
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', kickSymbols);
    window.removeEventListener('load', kickSymbols);
    window.clearInterval(slideTimer);
    leavingTimers.forEach((id) => window.clearTimeout(id));
    dotClicks.forEach((off) => off());
    backToTop?.removeEventListener('click', onTop);
    observers.forEach((observer) => observer.disconnect());
    symbolEls.forEach(({ el }) => el.remove());
    document.documentElement.classList.remove('is-ios');
  };
}
