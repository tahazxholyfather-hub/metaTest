import { useEffect } from "react";
import "./dental.css";
import Header from "./sections/Header";
import Hero from "./sections/Hero";
import Anatomy from "./sections/Anatomy";
import Services from "./sections/Services";
import { Results, Stats, Testimonials } from "./sections/SocialProof";
import Booking from "./sections/Booking";
import { About, Contact, Footer } from "./sections/StoryContact";

const STRIP = ["Digital 3D imaging", "Pain-free laser dentistry", "Same-day ceramics", "Clear aligners", "Sedation available", "Family friendly"];

function Strip() {
  const items = [...STRIP, ...STRIP];
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

export default function DentalLandingPage() {
  useEffect(() => {
    const prevTitle = document.title;
    const html = document.documentElement;
    const prevDir = html.getAttribute("dir");
    const prevLang = html.getAttribute("lang");
    const prevBg = document.body.style.background;
    document.title = "Lumière Dental — Expert Dental Care for a Brighter Smile";
    html.setAttribute("dir", "ltr");
    html.setAttribute("lang", "en");
    document.body.style.background = "#ffffff";
    return () => {
      document.title = prevTitle;
      if (prevDir) html.setAttribute("dir", prevDir);
      else html.removeAttribute("dir");
      if (prevLang) html.setAttribute("lang", prevLang);
      else html.removeAttribute("lang");
      document.body.style.background = prevBg;
    };
  }, []);

  return (
    <div className="dl" dir="ltr">
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
