import { useState } from 'react';
import { Link } from 'react-router-dom';
import { InstagramIcon, LinkedinIcon, MailIcon, PhoneIcon, PinIcon, TelegramIcon, YoutubeIcon } from './icons';

function TrustBadge({ src, alt, label, fallback, className }: { src: string; alt: string; label: string; fallback: string; className?: string }) {
  const [hide, setHide] = useState(false);
  return (
    <div className="trust-card" aria-label={label}>
      <img src={src} className={className} alt={alt} style={hide ? { display: 'none' } : undefined} onError={() => setHide(true)} />
      <span className="trust-fallback" style={{ display: hide ? 'block' : 'none' }}>{fallback}</span>
    </div>
  );
}

function SocialRow() {
  return (
    <div className="social-row">
      <a href="#" className="social-btn" aria-label="اینستاگرام"><InstagramIcon /></a>
      <a href="#" className="social-btn" aria-label="تلگرام"><TelegramIcon /></a>
      <a href="#" className="social-btn" aria-label="یوتیوب"><YoutubeIcon /></a>
      <a href="#" className="social-btn" aria-label="لینکدین"><LinkedinIcon /></a>
    </div>
  );
}

type Props = { variant: 'home' | 'sub'; enamadClass?: boolean };

export function SiteFooter({ variant, enamadClass = false }: Props) {
  const logoClass = variant === 'home' ? 'logo-img' : 'logo-img-ft';
  const aceSrc = variant === 'home' ? 'Ace_logo.png' : '/Ace_logo.png';
  return (
    <footer className="modern-footer">
      <div className="footer-aurora" />
      <div className="footer-glow-line" />
      <div className="footer-inner">
        <div className="footer-brand">
          <img src="https://metatest.app/logo.png" className={logoClass} alt="Metatest Logo" />
          <p className="footer-desc">متاتست نسل جدید یادگیری و ارزیابی است. محیطی سریع، هوشمند و زیبا که به شما اجازه می‌دهد مرزهای پیشرفت خود را جا به جا کنید.</p>
          <div className="trust-badges-container">
            <TrustBadge src="https://metatest.app/enamad.svg" alt="ای‌نماد" label="ای نماد" fallback="ای‌نماد" className={enamadClass ? 'enamad' : undefined} />
            <TrustBadge src="https://metatest.app/samandehi.png" alt="" label="ستاد ساماندهی" fallback="ساماندهی" />
          </div>
        </div>
        <div>
          <h4 className="footer-title">لینک‌های سریع</h4>
          {variant === 'home' ? (
            <ul className="footer-links">
              <li><Link to="/about/">درباره متاتست</Link></li>
              <li><a href="#plans">پلن‌ها و تعرفه‌ها</a></li>
              <li><a href="#">سوالات متداول</a></li>
              <li><Link to="/blog/">بلاگ آموزشی</Link></li>
            </ul>
          ) : (
            <ul className="footer-links">
              <li><Link to="/">صفحه اصلی</Link></li>
              <li><Link to="/#plans">پلن‌ها و تعرفه‌ها</Link></li>
              <li><Link to="/blog/">بلاگ آموزشی</Link></li>
              <li><Link to="/about/">درباره ما</Link></li>
            </ul>
          )}
        </div>
        <div>
          <h4 className="footer-title">دسترسی</h4>
          <ul className="footer-links">
            <li><a href="#" className="js-soon">دانلود اپلیکیشن</a></li>
            <li><a href="#">راهنمای شروع</a></li>
            <li><a href="#">قوانین و حریم خصوصی</a></li>
            <li><a href="#">پشتیبانی</a></li>
          </ul>
        </div>
        <div>
          <h4 className="footer-title">ارتباط با ما</h4>
          <div className="footer-contact-item">
            <PhoneIcon />
            <span dir="ltr">09120578911</span>
          </div>
          <div className="footer-contact-item">
            <MailIcon />
            <span dir="ltr">metatestinfo@gmail.com</span>
          </div>
          {variant === 'home' ? (
            <div className="footer-contact-item">
              <PinIcon />
              <span>مشهد، بلوار سجاد، امین غربی ۴، پلاک ۶، ساختمان A10</span>
            </div>
          ) : null}
          <SocialRow />
        </div>
      </div>
      <div className="footer-bottom">
        <div>تمامی حقوق برای متاتست محفوظ است © ۲۰۲۶</div>
        <div className="footer-credit">
          <span className="created-by-label">Created by</span>
          <img src={aceSrc} className="team-logo" alt="Programming team" />
        </div>
      </div>
    </footer>
  );
}
