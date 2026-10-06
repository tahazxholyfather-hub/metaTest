import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Logo } from "../ui";
import { Icon } from "../icons";
import { EASE, NAV } from "../data";


export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <motion.header
        className={`dl-header ${scrolled ? "is-scrolled" : ""}`}
        initial={reduced ? false : { y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: EASE, delay: 0.2 }}
      >
        <div className="dl-header-inner">
          <a href="#top" className="dl-logo" aria-label="Lumière Dental — home">
            <Logo />
            <span>Lumière Dental</span>
          </a>

          <nav className="dl-nav" aria-label="Primary">
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
          </nav>

          <div className="dl-header-actions">
            <a href="#booking" className="dl-btn dl-btn-primary dl-btn-sm dl-header-cta">
              Book Appointment
              <Icon.Arrow size={16} />
            </a>
            <button className="dl-menu-btn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
              <Icon.Menu size={20} />
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="dl-mobile-nav"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="dl-logo">
                <Logo />
                <span>Lumière Dental</span>
              </span>
              <button className="dl-menu-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
                <Icon.Close size={20} />
              </button>
            </div>
            <nav style={{ display: "flex", flexDirection: "column", marginTop: 40 }} aria-label="Mobile">
              {NAV.map((n, i) => (
                <motion.a
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.06, duration: 0.6, ease: EASE }}
                >
                  {n.label}
                </motion.a>
              ))}
            </nav>
            <div style={{ marginTop: "auto", display: "grid", gap: 12 }}>
              <a href="#booking" className="dl-btn dl-btn-primary" onClick={() => setOpen(false)}>
                Book Appointment
                <Icon.Arrow size={16} />
              </a>
              <span style={{ fontSize: 13, color: "var(--dl-ink-3)", textAlign: "center" }}>Mon – Sat · 8:00 – 19:00 · +1 (415) 555-0142</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
