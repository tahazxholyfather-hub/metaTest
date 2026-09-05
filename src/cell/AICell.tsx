import {
  forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef,
} from 'react';
import { CellEngine, type CellFrame } from './engine';
import {
  BLUSH_L, BLUSH_R, CELL_CX, CELL_CY, CELL_R, EYE_L, EYE_R, EYE_RX, EYE_RY, PUPIL_R,
} from './geometry';
import { DEFAULT_COLOR, THEMES, type CellColorName } from './themes';
import type { AICellHandle, AICellProps } from './types';
import './aicell.css';

type NodeMap = Record<string, SVGElement | null>;

/**
 * The AI cell character. Renders once; every animated attribute is written
 * directly to the SVG DOM from the engine's requestAnimationFrame loop.
 */
export const AICell = forwardRef<AICellHandle, AICellProps>(function AICell(props, ref) {
  const {
    size = '100%',
    initialState = 'idle',
    state, speaking, listening, mood, energy, speechIntensity,
    reducedMotion, atmosphere = true, interactive = true, color,
    className, style, ariaLabel = 'AI assistant character',
  } = props;

  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (s: string) => `aicell-${uid}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;

  const containerRef = useRef<HTMLDivElement>(null);
  const nodes = useRef<NodeMap>({});
  const cache = useRef<Record<string, string>>({});
  const engineRef = useRef<CellEngine | null>(null);

  const n = useCallback(
    (key: string) => (el: SVGElement | null) => {
      nodes.current[key] = el;
    },
    [],
  );

  /** Write an attribute only when it changed since the last frame. */
  const setA = (key: string, attr: string, value: string) => {
    const el = nodes.current[key];
    if (!el) return;
    const ck = key + '\u0000' + attr;
    if (cache.current[ck] === value) return;
    cache.current[ck] = value;
    el.setAttribute(attr, value);
  };

  const applyFrame = useCallback((f: CellFrame) => {
    const c = cache.current;
    setA('body', 'transform', f.bodyTransform);
    setA('bloom', 'd', f.membraneD);
    setA('membrane', 'd', f.membraneD);
    setA('clip', 'd', f.membraneD);
    setA('inner', 'd', f.membraneD);
    setA('rim', 'd', f.membraneD);

    setA('atmo', 'opacity', f.atmosphereOpacity.toFixed(3));
    setA('atmo', 'transform', `translate(${CELL_CX},${CELL_CY}) scale(${f.atmosphereScale.toFixed(3)}) translate(${-CELL_CX},${-CELL_CY})`);
    setA('shadow', 'opacity', f.shadowOpacity.toFixed(3));
    setA('shadow', 'transform', `translate(${CELL_CX},372) scale(${f.shadowScale.toFixed(3)},1) translate(${-CELL_CX},-372)`);
    setA('bloom', 'opacity', f.bloomOpacity.toFixed(3));
    setA('rim', 'opacity', f.rimOpacity.toFixed(3));
    setA('inner', 'opacity', f.innerGlowOpacity.toFixed(3));
    setA('coreLight', 'opacity', f.coreLightOpacity.toFixed(3));

    setA('rimStopTop', 'stop-color', f.rimTop);
    setA('rimStopBot', 'stop-color', f.rimBot);
    setA('atmoStopA', 'stop-color', f.atmoColor);
    setA('atmoStopB', 'stop-color', f.atmoColor);
    setA('bloom', 'stroke', f.bloomColor);
    setA('nucGlow', 'stroke', f.nucGlowColor);
    const rimEl = nodes.current.rim as SVGPathElement | null;
    if (rimEl && c.rimShadow !== f.rimShadow) {
      c.rimShadow = f.rimShadow;
      rimEl.style.filter = f.rimShadow;
    }

    // eyes -------------------------------------------------------------
    const wideL = Math.max(0, f.eyeOpenL - 1);
    const wideR = Math.max(0, f.eyeOpenR - 1);
    const ryL = (EYE_RY * f.eyeOpenL).toFixed(2);
    const ryR = (EYE_RY * f.eyeOpenR).toFixed(2);
    const rxL = (EYE_RX * (1 + wideL * 0.22)).toFixed(2);
    const rxR = (EYE_RX * (1 + wideR * 0.22)).toFixed(2);
    setA('whiteL', 'ry', ryL);
    setA('whiteR', 'ry', ryR);
    setA('whiteL', 'rx', rxL);
    setA('whiteR', 'rx', rxR);
    setA('eyeClip', 'ry', ryL);
    setA('eyeClip', 'rx', rxL);
    setA('eyeClipR', 'ry', ryR);
    setA('eyeClipR', 'rx', rxR);
    const normOpacity = (1 - f.eyeCurve).toFixed(3);
    setA('eyeLNorm', 'opacity', normOpacity);
    setA('eyeRNorm', 'opacity', normOpacity);
    const arcO = f.eyeCurve.toFixed(3);
    setA('arcL', 'opacity', arcO);
    setA('arcR', 'opacity', arcO);
    const lidO = f.lidOpacity.toFixed(3);
    setA('lidL', 'opacity', lidO);
    setA('lidR', 'opacity', lidO);
    const pupilT = `translate(${f.pupilX.toFixed(2)},${f.pupilY.toFixed(2)}) scale(${f.pupilScale.toFixed(3)})`;
    setA('pupilL', 'transform', pupilT);
    setA('pupilR', 'transform', pupilT);

    setA('browL', 'transform', f.browLTransform);
    setA('browR', 'transform', f.browRTransform);

    setA('mouth', 'd', f.mouthD);
    setA('mouthClip', 'd', f.mouthD);
    setA('mouth', 'fill-opacity', f.mouthFillOpacity.toFixed(3));
    setA('mouth', 'stroke-width', f.mouthStrokeW.toFixed(2));
    setA('tongue', 'opacity', f.tongueOpacity.toFixed(3));
    if (f.tongueOpacity > 0.005) {
      setA('tongue', 'transform', f.tongueTransform);
    }
    const blushO = f.blushOpacity.toFixed(3);
    setA('blushL', 'opacity', blushO);
    setA('blushR', 'opacity', blushO);

    // organelles ---------------------------------------------------------
    setA('nucleus', 'transform', f.nucleusTransform);
    setA('nucGlow', 'opacity', Math.min(1, f.nucleusGlow).toFixed(3));
    setA('mito', 'transform', f.mitoTransform);
    setA('vesicle', 'transform', f.vesicleTransform);
    for (let i = 0; i < f.dots.length; i++) {
      const d = f.dots[i];
      setA(`dot${i}`, 'transform', `translate(${d.x.toFixed(2)},${d.y.toFixed(2)})`);
      setA(`dot${i}`, 'opacity', d.o.toFixed(3));
    }

    // extras --------------------------------------------------------------
    for (let i = 0; i < f.sparkles.length; i++) {
      const s = f.sparkles[i];
      setA(`spark${i}`, 'opacity', s.o.toFixed(3));
      if (s.o > 0.005) {
        setA(`spark${i}`, 'transform', `translate(${s.x.toFixed(2)},${s.y.toFixed(2)}) scale(${s.s.toFixed(3)})`);
      }
    }
    setA('ring', 'opacity', f.ringOpacity.toFixed(3));
    if (f.ringOpacity > 0.005) {
      setA('ring', 'transform', `rotate(${f.ringRotation.toFixed(2)},${CELL_CX},${CELL_CY})`);
    }
    for (let i = 0; i < f.zzz.length; i++) {
      const z = f.zzz[i];
      setA(`zzz${i}`, 'opacity', z.o.toFixed(3));
      if (z.o > 0.005) {
        setA(`zzz${i}`, 'transform', `translate(${z.x.toFixed(2)},${z.y.toFixed(2)}) scale(${z.s.toFixed(3)})`);
      }
    }
  }, []);

  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;

  // Engine lifecycle ---------------------------------------------------------
  useEffect(() => {
    const engine = new CellEngine({ onFrame: applyFrame, initialState });
    engineRef.current = engine;
    engine.start();

    const onVisibility = () => engine.setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);

    let observer: IntersectionObserver | null = null;
    const el = containerRef.current;
    if (typeof IntersectionObserver !== 'undefined' && el) {
      observer = new IntersectionObserver((entries) => {
        const visible = entries[0]?.isIntersecting ?? true;
        engine.setPaused(document.hidden || !visible);
      });
      observer.observe(el);
    }

    const toView = (e: PointerEvent | MouseEvent) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return null;
      return {
        x: ((e.clientX - r.left) / r.width) * 400,
        y: ((e.clientY - r.top) / r.height) * 400,
      };
    };
    const onMove = (e: PointerEvent) => {
      if (!interactiveRef.current) return;
      const v = toView(e);
      if (v) engine.setPointer(v.x, v.y);
    };
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) engine.clearPointer();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerout', onOut);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onOut);
      engine.stop();
      engineRef.current = null;
      cache.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reduced motion -------------------------------------------------------------
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (reducedMotion !== undefined) {
      engine.reducedMotion = reducedMotion;
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    engine.reducedMotion = mq.matches;
    const onChange = () => {
      engine.reducedMotion = mq.matches;
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [reducedMotion]);

  // Body color theme -------------------------------------------------------------
  const applyTheme = useCallback((name: CellColorName) => {
    const th = THEMES[name] ?? THEMES[DEFAULT_COLOR];
    const set = (key: string, attr: string, value: string) => {
      nodes.current[key]?.setAttribute(attr, value);
      cache.current[key + '\u0000' + attr] = value;
    };
    th.membrane.forEach((c, i) => set(`memStop${i}`, 'stop-color', c));
    set('coreStopA', 'stop-color', th.coreA);
    set('coreStopB', 'stop-color', th.coreB);
    th.nucleus.forEach((c, i) => set(`nucStop${i}`, 'stop-color', c));
    set('inner', 'stroke', th.inner);
    set('dotsGroup', 'fill', th.dots);
    set('zzzGroup', 'fill', th.dots);
    set('sparkGroup', 'fill', th.dots);
    set('ringC1', 'stroke', th.inner);
    set('blushL', 'fill', th.blush);
    set('blushR', 'fill', th.blush);
    engineRef.current?.setTheme(th);
  }, []);

  useEffect(() => {
    applyTheme(color ?? DEFAULT_COLOR);
  }, [color, applyTheme]);

  // Controlled props → engine ---------------------------------------------------
  useEffect(() => {
    if (state !== undefined) engineRef.current?.setState(state);
  }, [state]);
  useEffect(() => {
    if (speaking !== undefined) engineRef.current?.setSpeaking(speaking);
  }, [speaking]);
  useEffect(() => {
    if (listening !== undefined) engineRef.current?.setListening(listening);
  }, [listening]);
  useEffect(() => {
    if (mood !== undefined) engineRef.current?.setMood(mood);
  }, [mood]);
  useEffect(() => {
    if (energy !== undefined) engineRef.current?.setEnergy(energy);
  }, [energy]);
  useEffect(() => {
    if (speechIntensity !== undefined) engineRef.current?.setSpeechIntensity(speechIntensity);
  }, [speechIntensity]);

  useImperativeHandle(
    ref,
    (): AICellHandle => ({
      setState: (s) => engineRef.current?.setState(s),
      getState: () => engineRef.current?.getState() ?? 'idle',
      setSpeaking: (b) => engineRef.current?.setSpeaking(b),
      setListening: (b) => engineRef.current?.setListening(b),
      setExpression: (e) => engineRef.current?.setExpression(e),
      setMood: (m) => engineRef.current?.setMood(m),
      setEnergy: (v) => engineRef.current?.setEnergy(v),
      setSpeechIntensity: (v) => engineRef.current?.setSpeechIntensity(v),
      poke: () => engineRef.current?.poke(),
      setColor: (c) => applyTheme(c),
    }),
    [applyTheme],
  );

  const sizeCss = typeof size === 'number' ? `${size}px` : size;

  // Static SVG scene — rendered exactly once. All motion happens via refs.
  const svg = useMemo(
    () => (
      <svg
        viewBox="0 0 400 400"
        role="img"
        aria-label={ariaLabel}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <radialGradient id={id('atmo')} cx="50%" cy="50%" r="50%">
            <stop ref={n('atmoStopA')} offset="0%" stopColor="#7C3AED" stopOpacity="0.4" />
            <stop ref={n('atmoStopB')} offset="52%" stopColor="#7C3AED" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={id('shadowG')} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0B0318" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0B0318" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={id('membraneG')} cx="42%" cy="36%" r="72%">
            <stop ref={n('memStop0')} offset="0%" stopColor="#401E7D" />
            <stop ref={n('memStop1')} offset="38%" stopColor="#361766" />
            <stop ref={n('memStop2')} offset="68%" stopColor="#411C80" />
            <stop ref={n('memStop3')} offset="86%" stopColor="#5524A6" />
            <stop ref={n('memStop4')} offset="96%" stopColor="#6D28D9" />
            <stop ref={n('memStop5')} offset="100%" stopColor="#7C3AED" />
          </radialGradient>
          <linearGradient id={id('rimG')} x1="0" y1="0" x2="0" y2="1">
            <stop ref={n('rimStopTop')} offset="0%" stopColor="#D8CCFF" />
            <stop ref={n('rimStopBot')} offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <radialGradient id={id('coreG')} cx="50%" cy="50%" r="50%">
            <stop ref={n('coreStopA')} offset="0%" stopColor="#A855F7" stopOpacity="0.65" />
            <stop ref={n('coreStopB')} offset="55%" stopColor="#8B5CF6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={id('nucG')} cx="38%" cy="30%" r="75%">
            <stop ref={n('nucStop0')} offset="0%" stopColor="#A863F2" />
            <stop ref={n('nucStop1')} offset="42%" stopColor="#8241DC" />
            <stop ref={n('nucStop2')} offset="82%" stopColor="#6526B4" />
            <stop ref={n('nucStop3')} offset="100%" stopColor="#571FA0" />
          </radialGradient>
          <radialGradient id={id('pupilG')} cx="38%" cy="34%" r="70%">
            <stop offset="0%" stopColor="#301352" />
            <stop offset="60%" stopColor="#1B0934" />
            <stop offset="100%" stopColor="#100522" />
          </radialGradient>
          <linearGradient id={id('mitoG')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F16DB3" />
            <stop offset="100%" stopColor="#D23387" />
          </linearGradient>
          <linearGradient id={id('vesG')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5B76F0" />
            <stop offset="100%" stopColor="#4048D8" />
          </linearGradient>
          <clipPath id={id('clip')}>
            <path ref={n('clip')} d="" />
          </clipPath>
          <clipPath id={id('eyeclip')}>
            <ellipse ref={n('eyeClip')} cx="0" cy="0" rx={EYE_RX} ry={EYE_RY} />
          </clipPath>
          <clipPath id={id('eyeclipR')}>
            <ellipse ref={n('eyeClipR')} cx="0" cy="0" rx={EYE_RX} ry={EYE_RY} />
          </clipPath>
          <clipPath id={id('mouthclip')}>
            <path ref={n('mouthClip')} d="" />
          </clipPath>
        </defs>

        {/* ground shadow + atmospheric halo */}
        <ellipse ref={n('shadow')} cx={CELL_CX} cy="372" rx="98" ry="13" fill={url('shadowG')} opacity="0.3" />
        {atmosphere && (
          <circle ref={n('atmo')} cx={CELL_CX} cy={CELL_CY} r="196" fill={url('atmo')} opacity="0.42" />
        )}

        <g ref={n('body')}>
          {/* soft bloom behind the membrane */}
          <path ref={n('bloom')} d="" fill="none" stroke="#7C3AED" strokeWidth="12" className="aicell-blur14" opacity="0.4" />

          {/* translucent body */}
          <path ref={n('membrane')} d="" fill={url('membraneG')} fillOpacity="0.97" />

          {/* interior, clipped to the living outline */}
          <g clipPath={url('clip')}>
            <ellipse cx="200" cy="322" rx="160" ry="86" fill="#0F0524" opacity="0.3" />
            {/* soft light pocket behind the face, as in the reference */}
            <ellipse cx="200" cy="180" rx="122" ry="104" fill={url('coreG')} opacity="0.2" />
            <ellipse ref={n('coreLight')} cx="214" cy="252" rx="92" ry="78" fill={url('coreG')} opacity="0.24" />

            {/* drifting cytoplasm dots */}
            <g ref={n('dotsGroup')} fill="#C4B5FD">
              {Array.from({ length: 9 }, (_, i) => (
                <circle key={i} ref={n(`dot${i}`)} r={[2.6, 1.8, 3.2, 2.1, 1.6, 2.8, 1.9, 2.4, 1.7][i]} opacity="0.2" />
              ))}
            </g>

            {/* mitochondrion */}
            <g ref={n('mito')} className="aicell-glow-pink">
              <rect x="-19" y="-9.5" width="38" height="19" rx="9.5" fill={url('mitoG')} stroke="#F9A8D4" strokeOpacity="0.55" strokeWidth="1.4" />
              <path d="M -11.5 -3 q 2.8 6.5 5.6 0 q 2.8 -6.5 5.6 0 q 2.8 6.5 5.6 0" fill="none" stroke="#FBCFE8" strokeWidth="2.1" strokeLinecap="round" opacity="0.85" />
            </g>

            {/* vesicle */}
            <g ref={n('vesicle')} className="aicell-glow-blue">
              <rect x="-12" y="-6" width="24" height="12" rx="6" fill={url('vesG')} stroke="#93C5FD" strokeOpacity="0.45" strokeWidth="1.2" />
              <ellipse cx="-3" cy="-1.8" rx="5" ry="2.2" fill="#A5B8FA" opacity="0.5" />
            </g>

            {/* nucleus */}
            <g ref={n('nucleus')}>
              <circle ref={n('nucGlow')} r="44" fill="none" stroke="#A855F7" strokeWidth="7" className="aicell-blur8" opacity="0.55" />
              <circle r="38" fill={url('nucG')} stroke="#C9A8F5" strokeOpacity="0.5" strokeWidth="1.6" />
              <ellipse cx="-12" cy="-15" rx="8.5" ry="5.5" fill="#E9D5FF" opacity="0.4" className="aicell-blur2" />
              <circle cx="10" cy="10" r="26" fill="#4C1786" opacity="0.35" className="aicell-blur4" />
            </g>

            {/* blush */}
            <ellipse ref={n('blushL')} cx={BLUSH_L.x} cy={BLUSH_L.y} rx="15" ry="7.5" fill="#F291DE" opacity="0" className="aicell-blur4" />
            <ellipse ref={n('blushR')} cx={BLUSH_R.x} cy={BLUSH_R.y} rx="15" ry="7.5" fill="#F291DE" opacity="0" className="aicell-blur4" />

            {/* face */}
            <g>
              <g ref={n('browL')}>
                <path d="M -14 2 Q -1 -7 14 0" fill="none" stroke="#160829" strokeWidth="7" strokeLinecap="round" />
              </g>
              <g ref={n('browR')}>
                <path d="M -14 2 Q -1 -7 14 0" fill="none" stroke="#160829" strokeWidth="7" strokeLinecap="round" />
              </g>

              <g transform={`translate(${EYE_L.x},${EYE_L.y})`}>
                <g ref={n('eyeLNorm')}>
                  <ellipse ref={n('whiteL')} rx={EYE_RX} ry={EYE_RY} fill="#F7F4FF" />
                  <g clipPath={url('eyeclip')}>
                    <g ref={n('pupilL')}>
                      <circle r={PUPIL_R} fill={url('pupilG')} />
                      <circle cx="-3.9" cy="-4.6" r="4.1" fill="#FFFFFF" />
                      <circle cx="4.2" cy="3.6" r="1.8" fill="#FFFFFF" opacity="0.55" />
                    </g>
                  </g>
                </g>
                <path ref={n('arcL')} d="M -18 7 Q 0 -15 18 7" fill="none" stroke="#F7F4FF" strokeWidth="7" strokeLinecap="round" opacity="0" />
                <path ref={n('lidL')} d="M -17 1 Q 0 8 17 1" fill="none" stroke="#DDD6FE" strokeWidth="5" strokeLinecap="round" opacity="0" />
              </g>

              <g transform={`translate(${EYE_R.x},${EYE_R.y})`}>
                <g ref={n('eyeRNorm')}>
                  <ellipse ref={n('whiteR')} rx={EYE_RX} ry={EYE_RY} fill="#F7F4FF" />
                  <g clipPath={url('eyeclipR')}>
                    <g ref={n('pupilR')}>
                      <circle r={PUPIL_R} fill={url('pupilG')} />
                      <circle cx="-3.9" cy="-4.6" r="4.1" fill="#FFFFFF" />
                      <circle cx="4.2" cy="3.6" r="1.8" fill="#FFFFFF" opacity="0.55" />
                    </g>
                  </g>
                </g>
                <path ref={n('arcR')} d="M -18 7 Q 0 -15 18 7" fill="none" stroke="#F7F4FF" strokeWidth="7" strokeLinecap="round" opacity="0" />
                <path ref={n('lidR')} d="M -17 1 Q 0 8 17 1" fill="none" stroke="#DDD6FE" strokeWidth="5" strokeLinecap="round" opacity="0" />
              </g>

              <path
                ref={n('mouth')}
                d=""
                fill="#12061F"
                fillOpacity="0"
                stroke="#160829"
                strokeWidth="5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* tongue, clipped inside the mouth cavity */}
              <g clipPath={url('mouthclip')}>
                <ellipse ref={n('tongue')} rx="9" ry="5.5" fill="#C2497F" opacity="0" />
              </g>
            </g>
          </g>

          {/* inner translucency edge, clipped so only the inside half shows */}
          <g clipPath={url('clip')}>
            <path ref={n('inner')} d="" fill="none" stroke="#A78BFA" strokeWidth="9" className="aicell-blur6" opacity="0.2" />
          </g>

          {/* neon rim */}
          <path ref={n('rim')} d="" fill="none" stroke={url('rimG')} strokeWidth="3" opacity="0.85" />

          {/* specular highlight */}
          <ellipse cx="150" cy="93" rx="56" ry="26" fill="#EDE9FE" opacity="0.09" className="aicell-blur8" transform="rotate(-24 150 93)" />
        </g>

        {/* orbit ring (loading / processing) */}
        <g ref={n('ring')} opacity="0">
          <circle ref={n('ringC1')} cx={CELL_CX} cy={CELL_CY} r={CELL_R + 26} fill="none" stroke="#A78BFA" strokeWidth="2" strokeDasharray="3 17" strokeLinecap="round" />
          <path
            d={`M ${CELL_CX + CELL_R + 26} ${CELL_CY} A ${CELL_R + 26} ${CELL_R + 26} 0 0 1 ${CELL_CX} ${CELL_CY + CELL_R + 26}`}
            fill="none" stroke="#C4B5FD" strokeWidth="2.6" strokeLinecap="round" opacity="0.9"
          />
        </g>

        {/* sparkles */}
        <g ref={n('sparkGroup')} fill="#E9D5FF" className="aicell-glow-spark">
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} ref={n(`spark${i}`)} d="M 0 -3.2 L 0.95 -0.95 L 3.2 0 L 0.95 0.95 L 0 3.2 L -0.95 0.95 L -3.2 0 L -0.95 -0.95 Z" opacity="0" />
          ))}
        </g>

        {/* zzz */}
        <g ref={n('zzzGroup')} fill="#DDD6FE" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fontWeight="700" fontSize="21" className="aicell-glow-spark">
          {Array.from({ length: 3 }, (_, i) => (
            <text key={i} ref={n(`zzz${i}`)} opacity="0">
              z
            </text>
          ))}
        </g>
      </svg>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, atmosphere, ariaLabel],
  );

  const pokeFromEvent = (e: { button?: number; clientX: number; clientY: number; currentTarget: EventTarget & HTMLElement }) => {
    if (interactive === false) return;
    if (e.button !== undefined && e.button !== 0) return;
    const engine = engineRef.current;
    if (!engine) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width > 1 && r.height > 1) {
      engine.setPointer(
        ((e.clientX - r.left) / r.width) * 400,
        ((e.clientY - r.top) / r.height) * 400,
      );
    }
    engine.poke();
  };

  return (
    <div
      ref={containerRef}
      className={`aicell${className ? ` ${className}` : ''}`}
      style={{ width: sizeCss, height: sizeCss, ...style }}
    >
      {svg}
      {interactive !== false && (
        <button
          type="button"
          className="aicell-hit"
          aria-label="Interact with character"
          onPointerDown={pokeFromEvent}
          onClick={pokeFromEvent}
        />
      )}
    </div>
  );
});
