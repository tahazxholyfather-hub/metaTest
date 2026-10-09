import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { AccentTitle, Img, Reveal, SectionHead, Stars } from "../ui";
import { Icon } from "../icons";
import { EASE, IMAGES } from "../data";
import { useLang } from "../i18n";
import { LazyCanvas } from "../three/LazyCanvas";
import { retouchSmile } from "../smileRetouch";

const FloatingScene = lazy(() => import("../three/FloatingScene"));

/* =========================================================
   Testimonials
   ========================================================= */

export function Testimonials() {
  const { t } = useLang();
  const items = t.reviews.items;
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const reduced = useReducedMotion();
  const paused = useRef(false);

  const go = useCallback((d: number) => {
    setDir(d);
    setI((v) => (v + d + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!paused.current) go(1);
    }, 6500);
    return () => window.clearInterval(id);
  }, [go]);

  const story = items[i];
  const copy = t.reviews;

  return (
    <section id="reviews" className="dl-section dl-testimonials">
      <div className="dl-container">
        <SectionHead eyebrow={copy.eyebrow} title={<AccentTitle parts={copy.title} />} align="center" />

        <div className="dl-testi-layout">
          <Reveal className="dl-testi-visual" blur={false}>
            <Img src={IMAGES.smile} alt={copy.photoAlt} />
            <div className="dl-testi-caption">
              <span>
                <strong>{copy.real}</strong>
                <span>{copy.consent}</span>
              </span>
              <span className="dl-testi-pill">{copy.pill}</span>
            </div>
          </Reveal>

          <Reveal
            className="dl-testi-card"
            delay={0.12}
            blur={false}
          >
            <div onPointerEnter={() => (paused.current = true)} onPointerLeave={() => (paused.current = false)}>
              <span className="dl-quote-mark" aria-hidden>
                ”
              </span>
              <Stars size={16} />
              <div style={{ position: "relative", minHeight: 200 }}>
                <AnimatePresence mode="wait" initial={false} custom={dir}>
                  <motion.div
                    key={i}
                    custom={dir}
                    initial={reduced ? false : { opacity: 0, x: 40 * dir, filter: "blur(4px)" }}
                    animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, x: -40 * dir, filter: "blur(4px)" }}
                    transition={{ duration: 0.6, ease: EASE }}
                  >
                    <p className="dl-testi-quote">{story.quote}</p>
                    <div className="dl-testi-meta">
                      <Img src={IMAGES.avatars[i]} alt="" />
                      <span>
                        <strong>{story.name}</strong>
                        <span>{story.treatment}</span>
                      </span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="dl-testi-controls">
              <div className="dl-dots" role="tablist" aria-label={copy.tabs}>
                {items.map((_, k) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={k === i}
                    aria-label={copy.tab(k + 1)}
                    className={k === i ? "is-active" : ""}
                    onClick={() => {
                      setDir(k > i ? 1 : -1);
                      setI(k);
                    }}
                  />
                ))}
              </div>
              <div className="dl-arrows">
                <button className="dl-arrow" aria-label={copy.prev} onClick={() => go(-1)}>
                  <Icon.ChevronLeft size={18} />
                </button>
                <button className="dl-arrow" aria-label={copy.next} onClick={() => go(1)}>
                  <Icon.ChevronRight size={18} />
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   Stats
   ========================================================= */

function CountUp({ to, suffix = "", decimals = 0, start }: { to: number; suffix?: string; decimals?: number; start: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const format = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  useEffect(() => {
    if (!start || reduced || !ref.current) return;
    const el = ref.current;
    const controls = animate(0, to, {
      duration: 2.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v: number) => {
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, to, decimals, reduced]);
  return (
    <>
      <span ref={ref}>{reduced || !start ? format(reduced ? to : 0) : format(0)}</span>
      <sup>{suffix}</sup>
    </>
  );
}

const STATS = [
  { to: 15, suffix: "+", icon: Icon.Award },
  { to: 10, suffix: "K+", icon: Icon.Users },
  { to: 98, suffix: "%", icon: Icon.Heart },
  { to: 4.9, suffix: "★", icon: Icon.Star, decimals: 1 },
];

export function Stats() {
  const { t } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [reduced ? 0 : 60, reduced ? 0 : -60]);

  return (
    <section className="dl-section dl-stats">
      <div className="dl-container">
        <div className="dl-stats-layout" ref={ref}>
          <motion.div className="dl-stats-visual" style={{ y }} aria-hidden>
            <LazyCanvas camera={{ position: [0, 0, 7], fov: 34 }} shadows={false}>
              <Suspense fallback={null}>
                <FloatingScene variant="stats" reducedMotion={!!reduced} />
              </Suspense>
            </LazyCanvas>
          </motion.div>

          <div>
            <SectionHead eyebrow={t.stats.eyebrow} title={<AccentTitle parts={t.stats.title} />} />
            <motion.div
              className="dl-stats-grid"
              style={{ marginTop: 40 }}
              initial={reduced ? false : "hidden"}
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
            >
              {STATS.map((s, i) => {
                const I = s.icon;
                return (
                  <motion.div
                    key={t.stats.items[i].label}
                    className="dl-stat"
                    variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } } }}
                  >
                    <div className="dl-stat-value">
                      <CountUp to={s.to} suffix={s.suffix} decimals={s.decimals ?? 0} start={inView} />
                    </div>
                    <div className="dl-stat-label">
                      <I size={16} />
                      {t.stats.items[i].label}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   Before / After
   ========================================================= */

/** Mounts the retouched before/after canvases; falls back to the plain photo if pixels cannot be read. */
function SmileLayers({ pos, beforeAlt, afterAlt }: { pos: number; beforeAlt: string; afterAlt: string }) {
  const beforeRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    const ac = new AbortController();
    retouchSmile(IMAGES.result, ac.signal)
      .then(({ before, after }) => {
        if (ac.signal.aborted || !beforeRef.current || !afterRef.current) return;
        beforeRef.current.replaceChildren(before);
        afterRef.current.replaceChildren(after);
        setState("ready");
      })
      .catch(() => {
        if (!ac.signal.aborted) setState("fallback");
      });
    return () => ac.abort();
  }, []);

  // The canvas hosts are left empty by React so the imperative inserts never fight reconciliation.
  return (
    <>
      <div className={`dl-compare-layer dl-compare-before ${state === "fallback" ? "is-fallback" : ""}`}>
        {state !== "ready" && <Img src={IMAGES.result} alt={beforeAlt} />}
        <div ref={beforeRef} className="dl-compare-layer" />
      </div>
      <div className="dl-compare-after-wrap" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <div className={`dl-compare-layer dl-compare-after ${state === "fallback" ? "is-fallback" : ""}`}>
          {state !== "ready" && <Img src={IMAGES.result} alt={afterAlt} />}
          <div ref={afterRef} className="dl-compare-layer" />
        </div>
      </div>
    </>
  );
}

export function Results() {
  const { t } = useLang();
  const copy = t.results;
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);
  const reduced = useReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.5 });

  // Reveal sweep when the comparison first enters view.
  useEffect(() => {
    if (!inView || reduced) return;
    const c = animate(18, 50, { duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.3, onUpdate: (v: number) => setPos(v) });
    return () => c.stop();
  }, [inView, reduced]);

  const update = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.min(96, Math.max(4, ((clientX - r.left) / r.width) * 100)));
  };

  return (
    <section id="results" className="dl-section dl-results">
      <div className="dl-container">
        <SectionHead eyebrow={copy.eyebrow} title={<AccentTitle parts={copy.title} />} lead={copy.lead} />

        <div className="dl-results-layout">
          <Reveal blur={false}>
            <div
              ref={ref}
              className="dl-compare"
              role="slider"
              aria-label={copy.slider}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pos)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setPos((p) => Math.max(4, p - 3));
                if (e.key === "ArrowRight") setPos((p) => Math.min(96, p + 3));
              }}
              onPointerDown={(e) => {
                dragging.current = true;
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                update(e.clientX);
              }}
              onPointerMove={(e) => dragging.current && update(e.clientX)}
              onPointerUp={() => (dragging.current = false)}
              onPointerCancel={() => (dragging.current = false)}
            >
              <SmileLayers pos={pos} beforeAlt={copy.beforeAlt} afterAlt={copy.afterAlt} />
              <span className="dl-compare-label before">{copy.before}</span>
              <span className="dl-compare-label after">{copy.after}</span>
              <div className="dl-compare-handle" style={{ left: `${pos}%` }}>
                <span className="dl-compare-knob">
                  <Icon.Drag size={20} />
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal className="dl-case" delay={0.15}>
            <span className="dl-eyebrow">{copy.caseEyebrow}</span>
            <h3 style={{ margin: "8px 0 4px", fontSize: 26, fontWeight: 500, letterSpacing: "-0.03em" }}>{copy.caseTitle}</h3>
            <p style={{ margin: 0, color: "var(--dl-ink-2)", lineHeight: 1.7, fontSize: 15 }}>{copy.caseBody}</p>
            <div>
              {copy.rows.map((row) => (
                <div className="dl-case-row" key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
            <a href="#booking" className="dl-btn dl-btn-ghost" style={{ width: "fit-content" }}>
              {copy.discuss}
              <Icon.Arrow size={16} />
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
