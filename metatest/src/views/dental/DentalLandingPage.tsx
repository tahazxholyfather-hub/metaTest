import "./dental.css";
import Header from "./sections/Header";
import Hero from "./sections/Hero";
import Anatomy from "./sections/Anatomy";
import Services from "./sections/Services";
import { Results, Stats, Testimonials } from "./sections/SocialProof";
import Booking from "./sections/Booking";
import { About, Contact, Footer } from "./sections/StoryContact";
import { LanguageProvider, useLang } from "./i18n";

function Strip() {
  const { t } = useLang();
  const items = [...t.strip, ...t.strip];
  return (
    <div className="dl-strip" aria-hidden>
      <div className="dl-strip-track">
        {items.map((s, i) => (
          <span className="dl-strip-item" key={i}>
            <i /> {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function Page() {
  const { dir } = useLang();
  return (
    <div className="dl" dir={dir}>
      <Header />
      <main>
        <Hero />
        <Strip />
        <Anatomy />
        <Services />
        <Testimonials />
        <Stats />
        <Results />
        <Booking />
        <About />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}

export default function DentalLandingPage() {
  return (
    <LanguageProvider>
      <Page />
    </LanguageProvider>
  );
}
