import { useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Img, Reveal, SectionHead } from "../ui";
import { Icon } from "../icons";
import { EASE, IMAGES } from "../data";

const TIMES = ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00"];
const TREATMENTS = ["Consultation", "General check-up & hygiene", "Cosmetic dentistry", "Dental implants", "Orthodontics", "Root canal", "Teeth whitening"];

export default function Booking() {
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
        <SectionHead
          eyebrow="Appointments"
          title={
            <>
              Book your visit in <span className="dl-serif dl-gradient-text">under a minute</span>
            </>
          }
          lead="Choose a convenient time and let our team take care of the rest. We confirm by phone or message within one working hour."
          align="center"
        />

        <Reveal className="dl-booking-shell" style={{ marginTop: "clamp(40px, 5vw, 64px)" }} blur={false} amount={0.15}>
          <div className="dl-booking-visual">
            <Img src={IMAGES.clinicChair} alt="A bright treatment room at Lumière Dental" />
            <div className="dl-booking-overlay">
              <h3>Calm rooms. Clear plans. No surprises.</h3>
              <p>Transparent pricing is shared before any treatment begins, and every room is designed for comfort.</p>
              <div className="dl-booking-chips">
                <span>Same-week availability</span>
                <span>Insurance friendly</span>
                <span>Free parking</span>
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
                    Thank you{name ? `, ${name.split(" ")[0]}` : ""}.
                  </h3>
                  <p style={{ margin: 0, color: "var(--dl-ink-2)", lineHeight: 1.7, maxWidth: "44ch" }}>
                    Your request for <strong style={{ color: "var(--dl-ink)", fontWeight: 600 }}>{time}</strong> has been received. Our
                    coordinator will confirm the exact slot shortly.
                  </p>
                  <button className="dl-btn dl-btn-ghost dl-btn-sm" onClick={() => setSent(false)} style={{ marginTop: 8 }}>
                    Book another appointment
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={submit}
                  initial={false}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4 }}
                >
                  <h3 style={{ margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: "-0.03em" }}>Request an appointment</h3>
                  <p style={{ margin: "8px 0 0", color: "var(--dl-ink-3)", fontSize: 14 }}>
                    Fields marked with * are required.
                  </p>

                  <div className="dl-form-grid">
                    <div className="dl-field">
                      <label htmlFor="dl-name">Full name *</label>
                      <input id="dl-name" required placeholder="Alex Morgan" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="dl-field">
                      <label htmlFor="dl-phone">Phone *</label>
                      <input id="dl-phone" required type="tel" inputMode="tel" placeholder="+1 (415) 555-0142" autoComplete="tel" />
                    </div>
                    <div className="dl-field">
                      <label htmlFor="dl-treatment">Treatment</label>
                      <select id="dl-treatment" defaultValue={TREATMENTS[0]}>
                        {TREATMENTS.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                      <span className="dl-field-icon">
                        <Icon.ChevronDown size={18} />
                      </span>
                    </div>
                    <div className="dl-field">
                      <label htmlFor="dl-date">Preferred date *</label>
                      <input id="dl-date" required type="date" min={min} />
                      <span className="dl-field-icon">
                        <Icon.Calendar size={18} />
                      </span>
                    </div>
                    <div className="dl-field span-2">
                      <label>Preferred time</label>
                      <div className="dl-times" role="radiogroup" aria-label="Preferred time">
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
                      <Icon.Shield size={16} /> Your details are encrypted and never shared.
                    </span>
                    <button type="submit" className="dl-btn dl-btn-primary">
                      Book Appointment
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
