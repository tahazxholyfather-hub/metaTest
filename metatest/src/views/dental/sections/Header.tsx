import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Logo } from "../ui";
import { Icon } from "../icons";
import { EASE } from "../data";
import { useLang } from "../i18n";
import type { Lang } from "../copy";
import { AppearanceControls } from "../theme";

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
  const { t, dir } = useLang();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    if (!open) return () => {
      document.body.style.overflow = "";
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

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
              <Icon.Menu size={18} />
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="dl-nav-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              onClick={close}
            />
            <motion.aside
              className="dl-side-menu"
              role="dialog"
              aria-label={t.navMobile}
              initial={reduced ? false : { opacity: 0, x: dir === "rtl" ? 28 : -28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir === "rtl" ? 28 : -28 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <div className="dl-side-top">
                <span className="dl-logo">
                  <Logo />
                  <span>{t.brand}</span>
                </span>
                <button className="dl-menu-btn" aria-label={t.closeMenu} onClick={close}>
                  <Icon.Close size={18} />
                </button>
              </div>
              <nav aria-label={t.navMobile}>
                {t.nav.map((n, i) => (
                  <a key={n.href} href={n.href} onClick={close}>
                    <em>0{i + 1}</em>
                    {n.label}
                  </a>
                ))}
              </nav>
              <div className="dl-side-settings">
                <div className="dl-side-lang">
                  <span>{t.langLabel}</span>
                  <LangSwitch />
                </div>
                <AppearanceControls />
              </div>
              <a href="#booking" className="dl-btn dl-btn-primary dl-btn-sm dl-side-book" onClick={close}>
                {t.book}
                <Icon.Arrow size={16} />
              </a>
              <span className="dl-mobile-hours">{t.headerHours}</span>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
