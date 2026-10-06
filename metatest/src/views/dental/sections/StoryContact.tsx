import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Img, Logo, Reveal, SectionHead } from "../ui";
import { Icon } from "../icons";
import { EASE, IMAGES, NAV } from "../data";

/* =========================================================
   About
   ========================================================= */

const VALUES = [
  { title: "15 years of expertise", text: "Founded in 2011, our clinicians have completed over 40,000 treatments across every speciality." },
  { title: "Technology that reassures", text: "Intra-oral scanners, 3D CBCT imaging and in-house ceramics shorten treatment and remove guesswork." },
  { title: "A team that listens", text: "Specialists, hygienists and coordinators work as one team, so your plan is consistent from first call to last visit." },
  { title: "Care that is personal", text: "No templates. Every plan is built around your anatomy, your goals and the pace you are comfortable with." },
];

export function About() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], [reduced ? 0 : 40, reduced ? 0 : -40]);
  const y2 = useTransform(scrollYProgress, [0, 1], [reduced ? 0 : 60, reduced ? 0 : -30]);

  return (
    <section id="about" className="dl-section">
      <div className="dl-container">
        <div className="dl-services-head">
          <SectionHead
            eyebrow="About the clinic"
            title={
              <>
                More than a <span className="dl-serif dl-gradient-text">dental clinic</span>
              </>
            }
            lead="Lumière was founded on a simple idea: that exceptional dentistry should feel calm, transparent and genuinely human. Fifteen years later, that idea still shapes every room, every instrument and every conversation."
          />
          <Reveal delay={0.1}>
            <a href="#booking" className="dl-btn dl-btn-ghost">
              Meet the team
              <Icon.Arrow size={16} />
            </a>
          </Reveal>
        </div>

        <div className="dl-about-grid" ref={ref}>
          <Reveal className="dl-about-img dl-about-a" blur={false}>
            <motion.div style={{ position: "absolute", inset: -40, y: y1 }}>
              <Img src={IMAGES.clinic} alt="The light-filled reception and treatment rooms at Lumière Dental" />
            </motion.div>
            <span className="dl-about-tag">
              <Icon.Pin size={14} /> Our studio, Marina District
            </span>
          </Reveal>
          <Reveal className="dl-about-img dl-about-b" delay={0.1} blur={false}>
            <motion.div style={{ position: "absolute", inset: -30, y: y2 }}>
              <Img src={IMAGES.consult} alt="A dentist reviewing a digital scan together with a patient" />
            </motion.div>
            <span className="dl-about-tag">
              <Icon.Sparkle size={14} /> Digital smile planning
            </span>
          </Reveal>
          <Reveal className="dl-about-c" delay={0.2} blur={false}>
            <div>
              <span className="dl-eyebrow" style={{ color: "#cfd9ff" }}>
                Our promise
              </span>
              <h3 style={{ marginTop: 14 }}>You will always understand what we recommend, and why.</h3>
              <p>Clear explanations, honest pricing, and the time to decide — that is how trust is built, one visit at a time.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
              <Img src={IMAGES.team} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.6)" }} />
              <span style={{ fontSize: 13, opacity: 0.9 }}>
                <strong style={{ display: "block", fontWeight: 600 }}>Dr. Adrian Marsh</strong>
                Founder &amp; Lead Dentist
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
          {VALUES.map((v, i) => (
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
  const rows = [
    { icon: Icon.Pin, k: "Address", v: "1210 Chestnut Street, Suite 300", s: "San Francisco, CA 94123" },
    { icon: Icon.Phone, k: "Phone", v: "+1 (415) 555-0142", s: "Emergency line available 24/7" },
    { icon: Icon.Mail, k: "Email", v: "hello@lumieredental.com", s: "We reply within one working day" },
    { icon: Icon.Clock, k: "Opening hours", v: "Mon – Fri 8:00 – 19:00", s: "Saturday 9:00 – 15:00 · Sunday closed" },
  ];

  return (
    <section id="contact" className="dl-section dl-contact">
      <div className="dl-container">
        <SectionHead
          eyebrow="Visit us"
          title={
            <>
              Find us in the <span className="dl-serif dl-gradient-text">Marina District</span>
            </>
          }
          lead="Two minutes from the Chestnut Street tram stop with validated parking beneath the building."
        />

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
                <strong>Lumière Dental Studio</strong>
                <span>1210 Chestnut Street · Open today until 19:00</span>
              </div>
              <a
                className="dl-btn dl-btn-primary dl-btn-sm"
                href="https://maps.google.com/?q=1210+Chestnut+Street+San+Francisco"
                target="_blank"
                rel="noreferrer"
              >
                Get directions
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
  const toTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  return (
    <footer className="dl-footer">
      <div className="dl-container">
        <div className="dl-footer-grid">
          <div>
            <span className="dl-logo">
              <Logo />
              <span>Lumière Dental</span>
            </span>
            <p>A modern dental studio in San Francisco combining advanced technology with calm, personal care — for healthier teeth and brighter smiles that last.</p>
            <div className="dl-social">
              <a href="#top" aria-label="Instagram">
                <Icon.Instagram size={18} />
              </a>
              <a href="#top" aria-label="Facebook">
                <Icon.Facebook size={18} />
              </a>
              <a href="#top" aria-label="LinkedIn">
                <Icon.Linkedin size={18} />
              </a>
            </div>
          </div>
          <div>
            <h5>Navigation</h5>
            <ul>
              {NAV.map((n) => (
                <li key={n.href}>
                  <a href={n.href}>{n.label}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h5>Services</h5>
            <ul>
              {["General Dentistry", "Cosmetic Dentistry", "Dental Implants", "Orthodontics", "Root Canal", "Teeth Whitening"].map((s) => (
                <li key={s}>
                  <a href="#services">{s}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h5>Contact</h5>
            <ul>
              <li>
                <a href="#contact">1210 Chestnut Street, Suite 300</a>
              </li>
              <li>
                <a href="tel:+14155550142">+1 (415) 555-0142</a>
              </li>
              <li>
                <a href="mailto:hello@lumieredental.com">hello@lumieredental.com</a>
              </li>
              <li>
                <a href="#contact">Mon – Fri 8:00 – 19:00</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="dl-footer-bottom">
          <span>© {new Date().getFullYear()} Lumière Dental Studio. All rights reserved.</span>
          <span style={{ display: "flex", gap: 20 }}>
            <a href="#top">Privacy</a>
            <a href="#top">Terms</a>
            <a href="#top">Accessibility</a>
          </span>
          <button className="dl-to-top" onClick={toTop}>
            Back to top
            <i>
              <Icon.ArrowUp size={16} />
            </i>
          </button>
        </div>
      </div>
    </footer>
  );
}
