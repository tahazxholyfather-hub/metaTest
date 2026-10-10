import { motion, useReducedMotion } from "framer-motion";
import { AccentTitle, Reveal, SectionHead } from "../ui";
import { Icon } from "../icons";
import { EASE } from "../data";
import { useLang } from "../i18n";

const ICONS = [Icon.Tooth, Icon.Root, Icon.Implant, Icon.Braces, Icon.Sparkle, Icon.Smile, Icon.Shield, Icon.Crown];

export default function Services() {
  const reduced = useReducedMotion();
  const { t } = useLang();
  const copy = t.services;
  return (
    <section id="services" className="dl-section">
      <div className="dl-container">
        <div className="dl-services-head">
          <SectionHead eyebrow={copy.eyebrow} title={<AccentTitle parts={copy.title} />} lead={copy.lead} />
          <Reveal delay={0.1}>
            <a href="#booking" className="dl-btn dl-btn-ghost">
              {copy.plan}
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
          {copy.items.map((s, i) => {
            const I = ICONS[i];
            return (
              <motion.article
                key={i}
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
                  {copy.more}
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
