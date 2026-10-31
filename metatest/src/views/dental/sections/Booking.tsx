import { useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AccentTitle, Img, Reveal, SectionHead } from "../ui";
import { Icon } from "../icons";
import { EASE, IMAGES } from "../data";
import { useLang } from "../i18n";

const TIMES = ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00"];

export default function Booking() {
  const { t, lang } = useLang();
  const copy = t.booking;
  const [time, setTime] = useState("10:30");
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");
  const reduced = useReducedMotion();

  const today = new Date();
  const min = today.toISOString().slice(0, 10);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <section id="booking" className="dl-section">
      <div className="dl-container">
        <SectionHead eyebrow={copy.eyebrow} title={<AccentTitle parts={copy.title} />} lead={copy.lead} align="center" />

        <Reveal className="dl-booking-shell" style={{ marginTop: "clamp(40px, 5vw, 64px)" }} blur={false} amount={0.15}>
          <div className="dl-booking-visual">
            <Img src={IMAGES.clinicChair} alt={copy.roomAlt} />
            <div className="dl-booking-overlay">
              <h3>{copy.calm}</h3>
              <p>{copy.calmBody}</p>
              <div className="dl-booking-chips">
                {copy.chips.map((chip) => (
                  <span key={chip}>{chip}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="dl-form">
            <AnimatePresence mode="wait">
              {sent ? (
                <motion.div
                  key="done"
                  className="dl-success"
                  initial={reduced ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: EASE }}
                >
                  <span className="dl-success-icon">
                    <Icon.Check size={28} />
                  </span>
                  <h3 style={{ margin: 0, fontSize: 28, fontWeight: 500, letterSpacing: "-0.03em" }}>
                    {copy.thanks(name.split(" ")[0] ?? "")}
                  </h3>
                  <p style={{ margin: 0, color: "var(--dl-ink-2)", lineHeight: 1.7, maxWidth: "44ch" }}>
                    {copy.receivedBefore}
                    <strong style={{ color: "var(--dl-ink)", fontWeight: 600 }}>{time}</strong>
                    {copy.receivedAfter}
                  </p>
                  <button className="dl-btn dl-btn-ghost dl-btn-sm" onClick={() => setSent(false)} style={{ marginTop: 8 }}>
                    {copy.another}
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key={lang}
                  onSubmit={submit}
                  initial={false}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4 }}
                >
                  <h3 style={{ margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: "-0.03em" }}>{copy.formTitle}</h3>
                  <p style={{ margin: "8px 0 0", color: "var(--dl-ink-3)", fontSize: 14 }}>{copy.requiredNote}</p>

                  <div className="dl-form-grid">
                    <div className="dl-field">
                      <label htmlFor="dl-name">{copy.name}</label>
                      <input id="dl-name" required placeholder={copy.namePh} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="dl-field">
                      <label htmlFor="dl-phone">{copy.phone}</label>
                      <input id="dl-phone" required type="tel" inputMode="tel" placeholder={copy.phonePh} autoComplete="tel" />
                    </div>
                    <div className="dl-field">
                      <label htmlFor="dl-treatment">{copy.treatment}</label>
                      <select id="dl-treatment" defaultValue={copy.treatments[0]}>
                        {copy.treatments.map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                      <span className="dl-field-icon">
                        <Icon.ChevronDown size={18} />
                      </span>
                    </div>
                    <div className="dl-field">
                      <label htmlFor="dl-date">{copy.date}</label>
                      <input id="dl-date" required type="date" min={min} />
                      <span className="dl-field-icon">
                        <Icon.Calendar size={18} />
                      </span>
                    </div>
                    <div className="dl-field span-2">
                      <label>{copy.time}</label>
                      <div className="dl-times" role="radiogroup" aria-label={copy.time}>
                        {TIMES.map((t) => (
                          <button
                            key={t}
                            type="button"
                            role="radio"
                            aria-checked={time === t}
                            className={`dl-time ${time === t ? "is-active" : ""}`}
                            onClick={() => setTime(t)}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="dl-form-foot">
                    <span className="dl-form-note">
                      <Icon.Shield size={16} /> {copy.privacy}
                    </span>
                    <button type="submit" className="dl-btn dl-btn-primary">
                      {t.book}
                      <Icon.Arrow size={18} />
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
