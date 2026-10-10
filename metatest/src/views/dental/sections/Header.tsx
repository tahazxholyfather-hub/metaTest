import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Logo } from "../ui";
import { Icon } from "../icons";
import { EASE } from "../data";
import { useLang } from "../i18n";
import type { Lang } from "../copy";
import { PALETTES, useTheme } from "../theme";

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

function ThemeControl() {
  const { t } = useLang();
  const { mode, toggleMode, preset, custom, primary, secondary, setPreset, setCustom } = useTheme();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const copy = t.theme;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="dl-theme" ref={root}>
      <button type="button" className="dl-theme-btn" aria-label={mode === "dark" ? copy.toLight : copy.toDark} onClick={toggleMode}>
        {mode === "dark" ? <Icon.Sun size={16} /> : <Icon.Moon size={16} />}
      </button>
      <button
        type="button"
        className="dl-theme-btn"
        aria-expanded={open}
        aria-label={copy.colors}
        onClick={() => setOpen((v) => !v)}
      >
        <i className="dl-theme-swatch" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }} />
      </button>
      {open && (
        <div className="dl-theme-pop" role="dialog" aria-label={copy.colors}>
          <span className="dl-theme-label">{copy.preset}</span>
          <div className="dl-theme-presets">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-label={p.id}
                aria-pressed={!custom && preset === p.id}
                style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` }}
                onClick={() => setPreset(p.id)}
              />
            ))}
          </div>
          <label>
            {copy.primary}
            <input type="color" value={primary} aria-label={copy.primary} onChange={(e) => setCustom(e.target.value, secondary)} />
          </label>
          <label>
            {copy.secondary}
            <input type="color" value={secondary} aria-label={copy.secondary} onChange={(e) => setCustom(primary, e.target.value)} />
          </label>
        </div>
      )}
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
            <ThemeControl />
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
            <div className="dl-mobile-nav-top">
              <span className="dl-logo">
                <Logo />
                <span>{t.brand}</span>
              </span>
              <button className="dl-menu-btn" aria-label={t.closeMenu} onClick={() => setOpen(false)}>
                <Icon.Close size={20} />
              </button>
            </div>
            <nav aria-label={t.navMobile}>
              {t.nav.map((n, i) => (
                <motion.a
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.04, duration: 0.45, ease: EASE }}
                >
                  {n.label}
                </motion.a>
              ))}
            </nav>
            <div className="dl-mobile-foot">
              <div className="dl-mobile-tools">
                <LangSwitch />
                <ThemeControl />
              </div>
              <a href="#booking" className="dl-btn dl-btn-primary dl-btn-sm" onClick={() => setOpen(false)}>
                {t.book}
                <Icon.Arrow size={16} />
              </a>
              <span className="dl-mobile-hours">{t.headerHours}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
