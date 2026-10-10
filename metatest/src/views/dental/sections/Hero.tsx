import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Img, Magnetic, Stars } from "../ui";
import { Icon } from "../icons";
import { EASE, IMAGES } from "../data";
import { LazyCanvas } from "../three/LazyCanvas";
import { useLang } from "../i18n";

const FloatingScene = lazy(() => import("../three/FloatingScene"));

const TRANSITIONS = [
  { initial: { y: 20, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: -20, opacity: 0 } },
  { initial: { opacity: 0, filter: "blur(8px)" }, animate: { opacity: 1, filter: "blur(0px)" }, exit: { opacity: 0, filter: "blur(8px)" } },
  { initial: { x: 24, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: -24, opacity: 0 } },
  { initial: { clipPath: "inset(0 100% 0 0)", opacity: 1 }, animate: { clipPath: "inset(0 0% 0 0)", opacity: 1 }, exit: { clipPath: "inset(0 0 0 100%)", opacity: 1 } },
  { initial: { scale: 0.92, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 1.06, opacity: 0 } },
];

function Rotator() {
  const { t } = useLang();
  const messages = t.hero.messages;
  const [i, setI] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    const id = window.setInterval(() => setI((v) => (v + 1) % messages.length), 3200);
    return () => window.clearInterval(id);
  }, [messages.length]);
  const fx = reduced ? TRANSITIONS[1] : TRANSITIONS[i % TRANSITIONS.length];
  return (
    <motion.div
      className="dl-rotator"
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: EASE, delay: 0.3 }}
    >
      <span className="dl-rotator-dot" aria-hidden />
      <span className="dl-rotator-text" aria-live="polite">
        <AnimatePresence initial={false}>
          <motion.span key={i} initial={fx.initial} animate={fx.animate} exit={fx.exit} transition={{ duration: 0.5, ease: EASE }}>
            {messages[i]}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.div>
  );
}

export default function Hero() {
  const { t } = useLang();
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const textY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -80]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.7], [1, reduced ? 1 : 0.2]);
  const visualY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 90]);
  const visualScale = useTransform(scrollYProgress, [0, 1], [1, reduced ? 1 : 0.94]);

  let wordIndex = 0;

  return (
    <section ref={ref} id="top" className="dl-hero">
      <div className="dl-hero-bg" />
      <div className="dl-hero-grid" aria-hidden />

      <div className="dl-container">
        <div className="dl-hero-layout">
          <motion.div className="dl-hero-copy" style={{ y: textY, opacity: textOpacity }}>
            <Rotator />

            <h1 className="dl-hero-title" key={t.hero.lines[0][0].text}>
              {t.hero.lines.map((line, li) => (
                <span className="dl-line" key={li}>
                  {line.map((word, wi) => {
                    const idx = wordIndex++;
                    return (
                      <motion.span
                        key={wi}
                        className={`dl-word ${word.highlight ? "dl-gradient-text" : ""}`}
                        initial={reduced ? false : { y: "110%", opacity: 0, filter: "blur(10px)" }}
                        animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                        transition={{ duration: 1.1, ease: EASE, delay: 0.45 + idx * 0.07 }}
                      >
                        {word.text}
                        {wi < line.length - 1 ? "\u00A0" : ""}
                      </motion.span>
                    );
                  })}
                </span>
              ))}
            </h1>

            <motion.p
              className="dl-hero-desc"
              initial={reduced ? false : { opacity: 0, y: 18, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 1, ease: EASE, delay: 1.05 }}
            >
              {t.hero.desc}
            </motion.p>

            <motion.div
              className="dl-hero-ctas"
              initial={reduced ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: EASE, delay: 1.25 }}
            >
              <Magnetic>
                <a href="#booking" className="dl-btn dl-btn-primary">
                  {t.book}
                  <Icon.Arrow size={18} />
                </a>
              </Magnetic>
              <Magnetic strength={0.15}>
                <a href="#about" className="dl-btn dl-btn-ghost">
                  <span className="dl-play">
                    <Icon.Play size={14} />
                  </span>
                  {t.hero.explore}
                </a>
              </Magnetic>
            </motion.div>

            <motion.div
              className="dl-hero-trust"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, ease: EASE, delay: 1.5 }}
            >
              <span className="dl-avatars">
                {IMAGES.avatars.slice(0, 4).map((a, i) => (
                  <Img key={i} src={a} alt="" loading="eager" />
                ))}
              </span>
              <span>
                <Stars size={12} />
                <br />
                {t.hero.trust} <strong style={{ color: "var(--dl-ink)", fontWeight: 600 }}>{t.hero.trustCount}</strong> {t.hero.patients}
              </span>
            </motion.div>
          </motion.div>

          <motion.div className="dl-hero-visual" style={{ y: visualY, scale: visualScale }}>
            <motion.div
              className="dl-portrait"
              initial={reduced ? false : { opacity: 0, y: 60, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1.4, ease: EASE, delay: 0.6 }}
            >
              <Img src={IMAGES.dentist} alt={t.hero.portraitAlt} loading="eager" />
            </motion.div>

            <div className="dl-hero-canvas" aria-hidden>
              <LazyCanvas camera={{ position: [0, 0, 8.5], fov: 34 }} shadows={false}>
                <Suspense fallback={null}>
                  <FloatingScene variant="hero" reducedMotion={!!reduced} />
                </Suspense>
              </LazyCanvas>
            </div>

            <motion.div
              className="dl-float-card dl-float-top"
              initial={reduced ? false : { opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, ease: EASE, delay: 1.4 }}
            >
              <span className="dl-float-icon">
                <Icon.Shield size={18} />
              </span>
              <span>
                <strong>{t.hero.painless}</strong>
                {t.hero.painlessSub}
              </span>
            </motion.div>

            <motion.div
              className="dl-float-card dl-float-bottom"
              initial={reduced ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, ease: EASE, delay: 1.6 }}
            >
              <span className="dl-float-icon">
                <Icon.Sparkle size={18} />
              </span>
              <span>
                <strong>{t.hero.doctor}</strong>
                {t.hero.doctorSub}
              </span>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div className="dl-scroll-cue" aria-hidden>
        <span>{t.hero.scroll}</span>
        <i />
      </div>
    </section>
  );
}
