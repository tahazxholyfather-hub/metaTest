import "./dental.css";
import Header from "./sections/Header";
import Hero from "./sections/Hero";
import Anatomy from "./sections/Anatomy";
import Services from "./sections/Services";
import { Results, Stats, Testimonials } from "./sections/SocialProof";
import Booking from "./sections/Booking";
import { About, Contact, Footer } from "./sections/StoryContact";
import { LanguageProvider, useLang } from "./i18n";
import { ThemeProvider, useTheme } from "./theme";

function Page() {
  const { dir } = useLang();
  const { mode, vars } = useTheme();
  return (
    <div className="dl" dir={dir} data-mode={mode} style={vars}>
      <Header />
      <main>
        <Hero />
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
      <ThemeProvider>
        <Page />
      </ThemeProvider>
    </LanguageProvider>
  );
}
