import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Img, Reveal, SectionHead, Stars } from "../ui";
import { Icon } from "../icons";
import { EASE, IMAGES } from "../data";
import { LazyCanvas } from "../three/LazyCanvas";

const FloatingScene = lazy(() => import("../three/FloatingScene"));

/* =========================================================
   Testimonials
   ========================================================= */

const TESTIMONIALS = [
  {
    quote:
      "I had avoided dentists for years. The team explained everything on the 3D scan before touching a single tooth, and the implant feels completely natural. I actually look forward to my visits now.",
    name: "Sophie Laurent",
    treatment: "Dental implant & crown",
    avatar: IMAGES.avatars[0],
  },
  {
    quote:
      "The whitening was calibrated to my enamel so there was zero sensitivity. Results looked natural, not artificial — exactly what I asked for.",
    name: "Marcus Chen",
    treatment: "Teeth whitening",
    avatar: IMAGES.avatars[1],
  },
  {
    quote:
      "Clear aligners with remote check-ins meant fewer trips across town. Eighteen months later my bite is corrected and the whole process was remarkably calm.",
    name: "Daniel Rossi",
    treatment: "Orthodontics · clear aligners",
    avatar: IMAGES.avatars[2],
  },
  {
    quote:
      "A root canal in one appointment, pain-free. I didn't think those words could go together. The clinic itself feels more like a design studio than a surgery.",
    name: "Amara Okafor",
    treatment: "Root canal therapy",
    avatar: IMAGES.avatars[3],
  },
];

export function Testimonials() {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const reduced = useReducedMotion();
  const paused = useRef(false);

  const go = useCallback((d: number) => {
    setDir(d);
    setI((v) => (v + d + TESTIMONIALS.length) % TESTIMONIALS.length);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!paused.current) go(1);
    }, 6500);
    return () => window.clearInterval(id);
  }, [go]);

  const t = TESTIMONIALS[i];

  return (
    <section id="reviews" className="dl-section dl-testimonials">
      <div className="dl-container">
        <SectionHead
          eyebrow="Patient stories"
          title={
            <>
              Smiles we are <span className="dl-serif dl-gradient-text">proud of</span>
            </>
          }
          align="center"
        />

        <div className="dl-testi-layout">
          <Reveal className="dl-testi-visual" blur={false}>
            <Img src={IMAGES.smile} alt="A patient smiling after treatment at Lumière Dental" />
            <div className="dl-testi-caption">
              <span>
                <strong>Real patients, real results</strong>
                <span>Photographed with consent</span>
              </span>
              <span className="dl-testi-pill">4.9 ★ · 1,200+ reviews</span>
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
                    <p className="dl-testi-quote">{t.quote}</p>
                    <div className="dl-testi-meta">
                      <Img src={t.avatar} alt="" />
                      <span>
                        <strong>{t.name}</strong>
                        <span>{t.treatment}</span>
                      </span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="dl-testi-controls">
              <div className="dl-dots" role="tablist" aria-label="Testimonials">
                {TESTIMONIALS.map((_, k) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={k === i}
                    aria-label={`Testimonial ${k + 1}`}
                    className={k === i ? "is-active" : ""}
                    onClick={() => {
                      setDir(k > i ? 1 : -1);
                      setI(k);
                    }}
                  />
                ))}
              </div>
              <div className="dl-arrows">
                <button className="dl-arrow" aria-label="Previous testimonial" onClick={() => go(-1)}>
                  <Icon.ChevronLeft size={18} />
                </button>
                <button className="dl-arrow" aria-label="Next testimonial" onClick={() => go(1)}>
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
  { to: 15, suffix: "+", label: "Years of experience", icon: Icon.Award },
  { to: 10, suffix: "K+", label: "Happy patients", icon: Icon.Users },
  { to: 98, suffix: "%", label: "Patient satisfaction", icon: Icon.Heart },
  { to: 4.9, suffix: "★", label: "Average rating", icon: Icon.Star, decimals: 1 },
];

export function Stats() {
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
            <SectionHead
              eyebrow="Why Lumière"
              title={
                <>
                  Trusted care, <span className="dl-serif dl-gradient-text">measured</span>
                </>
              }
            />
            <motion.div
              className="dl-stats-grid"
              style={{ marginTop: 40 }}
              initial={reduced ? false : "hidden"}
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
            >
              {STATS.map((s) => {
                const I = s.icon;
                return (
                  <motion.div
                    key={s.label}
                    className="dl-stat"
                    variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } } }}
                  >
                    <div className="dl-stat-value">
                      <CountUp to={s.to} suffix={s.suffix} decimals={s.decimals ?? 0} start={inView} />
                    </div>
                    <div className="dl-stat-label">
                      <I size={16} />
                      {s.label}
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

export function Results() {
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
        <SectionHead
          eyebrow="Real results"
          title={
            <>
              Before and after, <span className="dl-serif dl-gradient-text">side by side</span>
            </>
          }
          lead="Drag the divider to compare. Every case is planned digitally and photographed under the same studio lighting for an honest comparison."
        />

        <div className="dl-results-layout">
          <Reveal blur={false}>
            <div
              ref={ref}
              className="dl-compare"
              role="slider"
              aria-label="Before and after comparison"
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
              <Img src={IMAGES.result} alt="Patient smile before treatment" className="dl-compare-before" />
              <div className="dl-compare-after-wrap" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
                <Img src={IMAGES.result} alt="Patient smile after treatment" />
              </div>
              <span className="dl-compare-label before">Before</span>
              <span className="dl-compare-label after">After</span>
              <div className="dl-compare-handle" style={{ left: `${pos}%` }}>
                <span className="dl-compare-knob">
                  <Icon.Drag size={20} />
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal className="dl-case" delay={0.15}>
            <span className="dl-eyebrow">Case study 24</span>
            <h3 style={{ margin: "8px 0 4px", fontSize: 26, fontWeight: 500, letterSpacing: "-0.03em" }}>Smile design with six porcelain veneers</h3>
            <p style={{ margin: 0, color: "var(--dl-ink-2)", lineHeight: 1.7, fontSize: 15 }}>
              Minimal-preparation veneers designed in 3D and refined with a trial smile before the final ceramics were bonded.
            </p>
            <div>
              {[
                ["Concern", "Discolouration, uneven edges"],
                ["Treatment", "Whitening + 6 veneers"],
                ["Duration", "3 visits over 4 weeks"],
                ["Outcome", "Natural shade BL2, symmetrical line"],
              ].map(([k, v]) => (
                <div className="dl-case-row" key={k}>
                  <span>{k}</span>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
            <a href="#booking" className="dl-btn dl-btn-ghost" style={{ width: "fit-content" }}>
              Discuss your case
              <Icon.Arrow size={16} />
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
