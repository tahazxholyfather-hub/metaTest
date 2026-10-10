import { Suspense, lazy, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { AccentTitle, Reveal, SectionHead } from "../ui";
import { Icon } from "../icons";
import { LazyCanvas } from "../three/LazyCanvas";
import { ANATOMY, type AnatomyKey } from "../data";
import { useLang } from "../i18n";

const AnatomyScene = lazy(() => import("../three/AnatomyScene"));

function CrossSection({ active }: { active: AnatomyKey | null }) {
  const c = (k: AnatomyKey, on: string, off: string) => (active === k ? on : off);
  return (
    <svg viewBox="0 0 96 110" width="96" height="110" aria-hidden>
      <path d="M14 14c8-12 24-12 34 0 10-12 26-12 34 0 6 10 2 22-4 32-3 6-4 14-6 26-2 14-6 26-10 26-4 0-4-22-8-22s-4 22-8 22c-4 0-8-12-10-26-2-12-3-20-6-26-6-10-10-22-4-32Z" fill={c("enamel", "#dbe6ff", "#f3f1ec")} stroke={c("enamel", "#2f6bff", "#cfd6e2")} strokeWidth="1.2" />
      <path d="M22 22c6-8 18-8 26 0 8-8 20-8 26 0 4 8 1 18-3 26-2 6-3 14-5 24-1 10-4 20-7 20s-3-18-7-18-4 18-7 18-6-10-7-20c-2-10-3-18-5-24-4-8-7-18-3-26Z" fill={c("dentin", "#dbe6ff", "#ece2cc")} stroke={c("dentin", "#2f6bff", "none")} strokeWidth="1.2" />
      <path d="M36 44c4-6 20-6 24 0 2 4 0 10-2 14-1 4-2 10-3 18-1 6-2 10-3 10s-2-12-4-12-3 12-4 12-2-4-3-10c-1-8-2-14-3-18-2-4-4-10-2-14Z" fill={c("pulp", "#ffd1d9", "#f0b4bf")} stroke={c("pulp", "#e14c63", "none")} strokeWidth="1.2" />
      <path d="M44 62c0 10-1 24-2 24M52 62c0 10 1 24 2 24" stroke={c("nerve", "#e14c63", "#d98a98")} strokeWidth={active === "nerve" ? 2 : 1.2} strokeLinecap="round" />
      <path d="M0 60c20-6 32-8 48-8s28 2 48 8v10c-20-6-32-8-48-8s-28 2-48 8Z" fill={c("gum", "#ffd1d9", "#f2c7cf")} stroke={c("gum", "#e14c63", "none")} strokeWidth="1.2" opacity="0.9" />
      {active === "root" && <path d="M26 64c4 10 6 22 10 32M70 64c-4 10-6 22-10 32" stroke="#2f6bff" strokeWidth="1.4" strokeDasharray="3 3" fill="none" />}
    </svg>
  );
}

export default function Anatomy() {
  const [active, setActive] = useState<AnatomyKey | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const hotspotEls = useRef<Array<HTMLDivElement | null>>([]);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scroll = useSpring(scrollYProgress, { stiffness: 60, damping: 20, mass: 0.6 });
  const { t } = useLang();
  const copy = t.anatomy;
  const current = active ? copy.items[active] : null;

  return (
    <section id="anatomy" className="dl-section dl-anatomy">
      <div className="dl-container">
        <SectionHead eyebrow={copy.eyebrow} title={<AccentTitle parts={copy.title} />} lead={copy.lead} />

        <div className="dl-anatomy-layout" ref={ref}>
          <Reveal className="dl-anatomy-stage" amount={0.05} blur={false}>
            <LazyCanvas camera={{ position: [0.5, 1.1, 5.4], fov: 32 }} shadows style={{ position: "absolute", inset: 0 }}>
              <Suspense fallback={null}>
                <AnatomyScene active={active} scroll={scroll} reducedMotion={!!reduced} hotspotEls={hotspotEls} />
              </Suspense>
            </LazyCanvas>
            <div className="dl-hotspots">
              {ANATOMY.map((a, i) => (
                <div
                  key={a.key}
                  ref={(el) => {
                    hotspotEls.current[i] = el;
                  }}
                  className={`dl-hotspot ${active === a.key ? "is-active" : ""}`}
                >
                  <button type="button" aria-label={copy.items[a.key].label} className="dl-hotspot-dot" onClick={() => setActive(a.key)} />
                  <span className="dl-hotspot-line" />
                  <span className="dl-hotspot-label">{copy.items[a.key].label}</span>
                </div>
              ))}
            </div>
            <span className="dl-stage-badge">
              <i />               {copy.live}
            </span>
            <span className="dl-stage-hint">
              <Icon.Rotate size={14} /> {copy.hint}
            </span>
          </Reveal>

          <Reveal className="dl-anatomy-panel" delay={0.15} amount={0.05}>
            <div className="dl-anatomy-desc" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={active ?? "idle"}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.4 }}
                >
                  <h4>{current ? current.label : copy.idleTitle}</h4>
                  <p>{current ? current.description : copy.idleBody}</p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="dl-anatomy-list" role="tablist" aria-label={copy.eyebrow}>
              {ANATOMY.map((a, i) => (
                <button
                  key={a.key}
                  type="button"
                  role="tab"
                  className={`dl-anatomy-item ${active === a.key ? "is-active" : ""}`}
                  onMouseEnter={() => setActive(a.key)}
                  onFocus={() => setActive(a.key)}
                  onClick={() => setActive(a.key)}
                  aria-pressed={active === a.key}
                >
                  <span className="dl-anatomy-num">0{i + 1}</span>
                  <strong>{copy.items[a.key].label}</strong>
                </button>
              ))}
            </div>

            <div className="dl-anatomy-cross">
              <CrossSection active={active} />
              <span>{copy.cross}</span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
