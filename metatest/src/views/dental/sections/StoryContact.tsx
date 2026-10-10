import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { AccentTitle, Img, Logo, Reveal, SectionHead } from "../ui";
import { Icon } from "../icons";
import { EASE, IMAGES } from "../data";
import { useLang } from "../i18n";

/* =========================================================
   About
   ========================================================= */

export function About() {
  const { t } = useLang();
  const copy = t.about;
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], [reduced ? 0 : 40, reduced ? 0 : -40]);
  const y2 = useTransform(scrollYProgress, [0, 1], [reduced ? 0 : 60, reduced ? 0 : -30]);

  return (
    <section id="about" className="dl-section">
      <div className="dl-container">
        <div className="dl-services-head">
          <SectionHead eyebrow={copy.eyebrow} title={<AccentTitle parts={copy.title} />} lead={copy.lead} />
          <Reveal delay={0.1}>
            <a href="#booking" className="dl-btn dl-btn-ghost">
              {copy.meet}
              <Icon.Arrow size={16} />
            </a>
          </Reveal>
        </div>

        <div className="dl-about-grid" ref={ref}>
          <Reveal className="dl-about-img dl-about-a" blur={false}>
            <motion.div style={{ position: "absolute", inset: -40, y: y1 }}>
              <Img src={IMAGES.clinic} alt={copy.clinicAlt} />
            </motion.div>
            <span className="dl-about-tag">
              <Icon.Pin size={14} /> {copy.studio}
            </span>
          </Reveal>
          <Reveal className="dl-about-img dl-about-b" delay={0.1} blur={false}>
            <motion.div style={{ position: "absolute", inset: -30, y: y2 }}>
              <Img src={IMAGES.consult} alt={copy.consultAlt} />
            </motion.div>
            <span className="dl-about-tag">
              <Icon.Sparkle size={14} /> {copy.planning}
            </span>
          </Reveal>
          <Reveal className="dl-about-c" delay={0.2} blur={false}>
            <div>
              <span className="dl-eyebrow" style={{ color: "#cfd9ff" }}>
                {copy.promiseEyebrow}
              </span>
              <h3 style={{ marginTop: 14 }}>{copy.promise}</h3>
              <p>{copy.promiseBody}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
              <Img src={IMAGES.team} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.6)" }} />
              <span style={{ fontSize: 13, opacity: 0.9 }}>
                <strong style={{ display: "block", fontWeight: 600 }}>{copy.founder}</strong>
                {copy.founderRole}
              </span>
            </div>
          </Reveal>
        </div>

        <motion.div
          className="dl-about-values"
          initial={reduced ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
        >
          {copy.values.map((v, i) => (
            <motion.div
              key={v.title}
              className="dl-value"
              variants={{ hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } } }}
            >
              <span className="dl-value-num">0{i + 1}</span>
              <h4>{v.title}</h4>
              <p>{v.text}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* =========================================================
   Contact
   ========================================================= */

function MapArt() {
  return (
    <svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="dl-road" x1="0" x2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f7f9fe" />
        </linearGradient>
        <radialGradient id="dl-park" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#dcefe3" />
          <stop offset="1" stopColor="#e4f1e8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="520" fill="#eef2f9" />
      <ellipse cx="170" cy="380" rx="150" ry="110" fill="url(#dl-park)" />
      <ellipse cx="640" cy="120" rx="130" ry="90" fill="url(#dl-park)" />
      <path d="M-20 420 C 200 360, 320 420, 520 330 S 760 240, 840 260" stroke="#d6dfef" strokeWidth="26" fill="none" strokeLinecap="round" />
      <path d="M-20 420 C 200 360, 320 420, 520 330 S 760 240, 840 260" stroke="url(#dl-road)" strokeWidth="18" fill="none" strokeLinecap="round" />
      <g stroke="#dfe6f2" strokeWidth="10" fill="none" strokeLinecap="round">
        <path d="M120 -20 L 180 540" />
        <path d="M330 -20 L 380 540" />
        <path d="M540 -20 L 500 540" />
        <path d="M-20 140 L 820 90" />
        <path d="M-20 260 L 820 200" />
      </g>
      <g stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round">
        <path d="M120 -20 L 180 540" />
        <path d="M330 -20 L 380 540" />
        <path d="M540 -20 L 500 540" />
        <path d="M-20 140 L 820 90" />
        <path d="M-20 260 L 820 200" />
      </g>
      <g fill="#e3e9f4">
        <rect x="200" y="160" width="80" height="60" rx="8" />
        <rect x="400" y="110" width="90" height="70" rx="8" />
        <rect x="560" y="300" width="110" height="80" rx="8" />
        <rect x="220" y="290" width="70" height="55" rx="8" />
        <rect x="620" y="150" width="60" height="50" rx="8" />
      </g>
    </svg>
  );
}

export function Contact() {
  const { t } = useLang();
  const copy = t.contact;
  const icons = [Icon.Pin, Icon.Phone, Icon.Mail, Icon.Clock];
  const rows = copy.rows.map((row, i) => ({ ...row, icon: icons[i] }));

  return (
    <section id="contact" className="dl-section dl-contact">
      <div className="dl-container">
        <SectionHead eyebrow={copy.eyebrow} title={<AccentTitle parts={copy.title} />} lead={copy.lead} />

        <div className="dl-contact-layout">
          <Reveal className="dl-contact-list">
            {rows.map((r) => {
              const I = r.icon;
              return (
                <div className="dl-contact-row" key={r.k}>
                  <span className="dl-contact-icon">
                    <I size={20} />
                  </span>
                  <div>
                    <span>{r.k}</span>
                    <strong>{r.v}</strong>
                    <small>{r.s}</small>
                  </div>
                </div>
              );
            })}
          </Reveal>

          <Reveal className="dl-map" delay={0.12} blur={false}>
            <MapArt />
            <div className="dl-map-pin">
              <span className="dl-map-pin-dot" />
            </div>
            <div className="dl-map-card">
              <div>
                <strong>{copy.mapTitle}</strong>
                <span>{copy.mapSub}</span>
              </div>
              <a
                className="dl-btn dl-btn-primary dl-btn-sm"
                href={copy.directionsHref}
                target="_blank"
                rel="noreferrer"
              >
                {copy.directions}
                <Icon.Arrow size={16} />
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   Footer
   ========================================================= */

export function Footer() {
  const { t } = useLang();
  const copy = t.footer;
  const toTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  return (
    <footer className="dl-footer">
      <div className="dl-container">
        <div className="dl-footer-grid">
          <div>
            <span className="dl-logo">
              <Logo />
              <span>{t.brand}</span>
            </span>
            <p>{copy.blurb}</p>
            <div className="dl-social">
              <a href="#top" aria-label={copy.instagram}>
                <Icon.Instagram size={18} />
              </a>
              <a href="#top" aria-label={copy.facebook}>
                <Icon.Facebook size={18} />
              </a>
              <a href="#top" aria-label={copy.linkedin}>
                <Icon.Linkedin size={18} />
              </a>
            </div>
          </div>
          <div>
            <h5>{copy.navigation}</h5>
            <ul>
              {t.nav.map((n) => (
                <li key={n.href}>
                  <a href={n.href}>{n.label}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h5>{t.services.footerTitle}</h5>
            <ul>
              {t.services.items.map((s) => (
                <li key={s.title}>
                  <a href="#services">{s.title}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h5>{copy.contact}</h5>
            <ul>
              <li>
                <a href="#contact">{copy.address}</a>
              </li>
              <li>
                <a href={copy.phoneHref}>{copy.phone}</a>
              </li>
              <li>
                <a href={copy.emailHref}>{copy.email}</a>
              </li>
              <li>
                <a href="#contact">{copy.hours}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="dl-footer-bottom">
          <span>{copy.rights(new Date().getFullYear())}</span>
          <span style={{ display: "flex", gap: 20 }}>
            <a href="#top">{copy.privacy}</a>
            <a href="#top">{copy.terms}</a>
            <a href="#top">{copy.accessibility}</a>
          </span>
          <button className="dl-to-top" onClick={toTop}>
            {copy.toTop}
            <i>
              <Icon.ArrowUp size={16} />
            </i>
          </button>
        </div>
      </div>
    </footer>
  );
}
