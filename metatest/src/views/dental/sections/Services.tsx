import { motion, useReducedMotion } from "framer-motion";
import { Reveal, SectionHead } from "../ui";
import { Icon } from "../icons";
import { EASE } from "../data";

const SERVICES = [
  {
    icon: Icon.Tooth,
    title: "General Dentistry",
    text: "Comprehensive examinations, gentle hygiene visits and preventive care that keeps small issues from becoming big ones.",
  },
  {
    icon: Icon.Sparkle,
    title: "Cosmetic Dentistry",
    text: "Veneers, bonding and digital smile design — subtle, natural improvements planned with you in 3D before we begin.",
  },
  {
    icon: Icon.Implant,
    title: "Dental Implants",
    text: "Guided implant placement with premium titanium and ceramic restorations that look, feel and function like your own teeth.",
  },
  {
    icon: Icon.Braces,
    title: "Orthodontics",
    text: "Clear aligners and discreet braces for adults and teens, monitored remotely so you visit less and smile sooner.",
  },
  {
    icon: Icon.Root,
    title: "Root Canal",
    text: "Microscope-assisted endodontics that saves natural teeth comfortably — usually in a single, calm appointment.",
  },
  {
    icon: Icon.Smile,
    title: "Teeth Whitening",
    text: "Clinically supervised whitening calibrated to your enamel, for a brighter result without sensitivity.",
  },
];

export default function Services() {
  const reduced = useReducedMotion();
  return (
    <section id="services" className="dl-section">
      <div className="dl-container">
        <div className="dl-services-head">
          <SectionHead
            eyebrow="Our services"
            title={
              <>
                Complete care, <span className="dl-serif dl-gradient-text">thoughtfully delivered</span>
              </>
            }
            lead="Six specialities under one roof, so your care is coordinated by a team that knows your history — not a referral chain."
          />
          <Reveal delay={0.1}>
            <a href="#booking" className="dl-btn dl-btn-ghost">
              Plan a consultation
              <Icon.Arrow size={16} />
            </a>
          </Reveal>
        </div>

        <motion.div
          className="dl-services-grid"
          initial={reduced ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}
        >
          {SERVICES.map((s, i) => {
            const I = s.icon;
            return (
              <motion.article
                key={s.title}
                className="dl-service"
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
                }}
              >
                <div className="dl-service-top">
                  <span className="dl-service-icon">
                    <I size={24} />
                  </span>
                  <span className="dl-service-index">0{i + 1}</span>
                </div>
                <div>
                  <h3>{s.title}</h3>
                </div>
                <p>{s.text}</p>
                <a href="#booking" className="dl-service-link">
                  Learn more
                  <Icon.Arrow size={16} />
                </a>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
