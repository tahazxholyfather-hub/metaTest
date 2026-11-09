import { useEffect, useRef, type ReactNode } from 'react';
import { appUrl } from '../lib/appUrl';
import { startHomeStage } from '../lib/homeStage';
import { HomeBlog } from '../components/HomeBlog';
import { ChevronUpIcon } from '../components/icons';
import { LordIcon } from '../components/LordIcon';
import { PlansSection } from '../components/PlansSection';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { Testimonials } from '../components/Testimonials';

const COLORS = 'primary:#F8F7FF,secondary:#8b5cf6';

const SLIDES: { title: ReactNode; desc: string }[] = [
  { title: <>یادگیری هوشمند<br />در محیطی زنده</>, desc: 'پلتفرم جامع ارزیابی، آزمون و تحلیل عملکرد. ابزاری مدرن برای پیشرفت بدون محدودیت در فضایی استاندارد.' },
  { title: <>شیمی، فیزیک، ریاضی<br />و زیست را تمرین کنید</>, desc: 'با دقت بالا پایه، درس، فصل و مبحث دلخواهتان را انتخاب کنید و به صورت اختصاصی تست بزنید.' },
  { title: <>هوش مصنوعی<br />همراه همیشگی شماست</>, desc: 'چت کنید، سوال بپرسید و حل مشکلات درسی خود را به معلم خصوصی هوشمند متاتست بسپارید.' },
];

const FEATURES = [
  { src: '/doodle-motif-10-puzzle-in-reveal.json', title: 'آموزش شبیه به بازی', desc: 'محیطی شبیه به بازی برای تمرین دروس شیمی، فیزیک، ریاضی و زیست. با دقت بالا پایه، درس، فصل و مبحث دلخواهتان را برای تمرین انتخاب کنید و لذت ببرید.' },
  { src: '/doodle-motif-316-growth-in-reveal.json', title: 'تحلیل دقیق عملکرد', desc: 'نمودارهای زنده و بازخوردهای لحظه‌ای، داده‌های مفیدی از نحوه مطالعه و تمرین به شما ارائه می‌دهند تا نقاط قوت و ضعف خود را به شفاف‌ترین شکل ممکن بشناسید.' },
  { src: '/doodle-motif-709-cloud-user-in-reveal.json', title: 'هوش مصنوعی همراه', desc: 'یک هوش مصنوعی شخصی‌سازی شده که مانند یک معلم واقعی احساسات و تخصص دارد. چت کنید، سوال بپرسید و حل پیچیده‌ترین مشکلات درسی خود را به او بسپارید.' },
];

export function HomePage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const href = appUrl();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    return startHomeStage(root);
  }, []);

  return (
    <div ref={rootRef}>
      <div className="ambient-veil" />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <div className="depth-world" id="depth-world" />
          <SiteHeader active="home" logoLinkClass="logo" logoAlt="Metatest Logo" logoLabel="Metatest Home" />
          <section className="hero">
            <div className="hero-inner">
              <div className="hero-slider-wrap">
                <div className="slides-container">
                  {SLIDES.map((slide, index) => (
                    <div className={index === 0 ? 'slide active' : 'slide'} data-index={index} key={slide.desc}>
                      <h1 className="slide-title shine-title">{slide.title}</h1>
                      <p className="slide-desc">{slide.desc}</p>
                    </div>
                  ))}
                </div>
                <a href={href} className="btn-uiverse js-app">شروع کنید</a>
                <div className="slider-dots">
                  {SLIDES.map((slide, index) => (
                    <button key={slide.desc} type="button" className={index === 0 ? 'dot active' : 'dot'} data-index={index} aria-label={`اسلاید ${['۱', '۲', '۳'][index]}`} />
                  ))}
                </div>
              </div>
              <div className="hero-phone-stage">
                <div className="phone-glow" />
                <div className="phone-frame">
                  <div className="phone-notch" />
                  <div className="phone-screen">
                    <img src="/app-preview.png" className="phone-screen-img" alt="پیش‌نمایش اپلیکیشن متاتست" />
                  </div>
                </div>
              </div>
            </div>
          </section>
          {FEATURES.map((feature) => (
            <section className="aww-section" key={feature.src}>
              <div className="feature-container">
                <div className="slide-icon-wrap reveal-element stagger-1">
                  <LordIcon src={feature.src} trigger="in" colors={COLORS} style={{ width: '100%', height: '100%' }} />
                </div>
                <div className="slide-text">
                  <h2 className="sec-title shine-title reveal-element stagger-2">{feature.title}</h2>
                  <p className="sec-desc reveal-element stagger-3">{feature.desc}</p>
                </div>
              </div>
            </section>
          ))}
          <PlansSection />
          <Testimonials />
          <section className="cta-section reveal-section">
            <div className="cta-card reveal-element stagger-1">
              <div className="cta-inner">
                <div className="sec-eyebrow">آینده‌ات از همین‌جا شروع می‌شود</div>
                <h2 className="cta-title shine-title">آماده‌ای مرزهای پیشرفتت را<br />جابه‌جا کنی؟</h2>
                <p className="cta-desc">همین حالا به هزاران دانش‌آموز بپیوند که هر روز با متاتست تمرین می‌کنند، رقابت می‌کنند و از معلم خصوصی هوش مصنوعی کمک می‌گیرند. شروع رایگان است.</p>
                <a href={href} className="btn-uiverse js-app">بزن بریم!</a>
              </div>
            </div>
          </section>
          <HomeBlog />
          <SiteFooter variant="home" enamadClass />
        </div>
      </div>
      <button type="button" className="back-to-top" id="back-to-top" aria-label="بازگشت به بالا">
        <ChevronUpIcon />
      </button>
    </div>
  );
}
