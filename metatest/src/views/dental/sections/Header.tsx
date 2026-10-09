import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Logo } from "../ui";
import { Icon } from "../icons";
import { EASE } from "../data";
import { useLang } from "../i18n";
import type { Lang } from "../copy";

function LangSwitch() {
  const { lang, setLang, t } = useLang();
  const choose = (next: Lang) => () => setLang(next);
  return (
    <div className="dl-lang" role="group" aria-label={t.langLabel}>
      <button type="button" data-lang="en" aria-pressed={lang === "en"} onClick={choose("en")}>
        EN
      </button>
      <button type="button" data-lang="fa" aria-pressed={lang === "fa"} onClick={choose("fa")}>
        فا
      </button>
    </div>
  );
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const { t } = useLang();

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
          <a href="#top" className="dl-logo" aria-label={t.brandHome}>
            <Logo />
            <span>{t.brand}</span>
          </a>

          <nav className="dl-nav" aria-label={t.navPrimary}>
            {t.nav.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
          </nav>

          <div className="dl-header-actions">
            <LangSwitch />
            <a href="#booking" className="dl-btn dl-btn-primary dl-btn-sm dl-header-cta">
              {t.book}
              <Icon.Arrow size={16} />
            </a>
            <button className="dl-menu-btn" aria-label={t.openMenu} aria-expanded={open} onClick={() => setOpen(true)}>
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
                <span>{t.brand}</span>
              </span>
              <button className="dl-menu-btn" aria-label={t.closeMenu} onClick={() => setOpen(false)}>
                <Icon.Close size={20} />
              </button>
            </div>
            <nav style={{ display: "flex", flexDirection: "column", marginTop: 40 }} aria-label={t.navMobile}>
              {t.nav.map((n, i) => (
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
              <LangSwitch />
              <a href="#booking" className="dl-btn dl-btn-primary" onClick={() => setOpen(false)}>
                {t.book}
                <Icon.Arrow size={16} />
              </a>
              <span style={{ fontSize: 13, color: "var(--dl-ink-3)", textAlign: "center" }}>{t.headerHours}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
