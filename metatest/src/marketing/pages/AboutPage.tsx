import { Link } from 'react-router-dom';
import { appUrl } from '../lib/appUrl';
import { BoltIcon, BookIcon } from '../components/icons';
import { AboutShowcases } from '../components/AboutShowcases';
import { PageField } from '../components/PageField';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';

const VALUES = [
  { icon: 'vi1', title: 'سرعت و لذت', desc: 'یادگیری باید سریع، جذاب و انگیزه‌بخش باشد. ما هر چیزی که تجربه را کند یا کسل‌کننده کند حذف می‌کنیم.', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg> },
  { icon: 'vi2', title: 'دقت علمی', desc: 'تمام سؤالات و محتواها توسط معلمان متخصص بررسی می‌شوند. هیچ‌چیزی بدون تأیید علمی وارد سیستم نمی‌شود.', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg> },
  { icon: 'vi3', title: 'دسترسی برای همه', desc: 'متاتست برای دانش‌آموزانی است که در هر نقطه‌ای از ایران هستند. پلن رایگان ما همیشه پابرجاست.', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg> },
  { icon: 'vi4', title: 'اول کاربر', desc: 'هر تصمیمی که می‌گیریم با یک سؤال شروع می‌شود: آیا این برای دانش‌آموز بهتر است؟ نه برای ما، برای آن‌ها.', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg> },
  { icon: 'vi5', title: 'هوش مصنوعی اخلاقی', desc: 'معلم هوشمند ما طراحی شده تا کمک‌کار باشد، نه جایگزین. یاد می‌دهد، توضیح می‌دهد و صبور است.', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg> },
  { icon: 'vi6', title: 'داده‌محور', desc: 'هر اشتباهی یک داده است. تحلیل عملکرد ما به شما نشان می‌دهد کجا ضعیفید و چطور قوی‌تر شوید.', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg> },
];

const TEAM = [
  { avatar: 'av1', letter: 'ط', name: 'طاها', role: 'مدیر محصول و توسعه‌دهنده ارشد', bio: 'معمار اصلی متاتست. ترکیب مهندسی و درک عمیق از نیاز دانش‌آموزان.' },
  { avatar: 'av2', letter: 'م', name: 'محمد', role: 'توسعه‌دهنده Back-end', bio: 'مغز پشت سرورها، دیتابیس و تمام لایه‌های پنهانی که سایت را روان نگه می‌دارند.' },
  { avatar: 'av3', letter: 'س', name: 'سارا', role: 'طراح محتوا و تجربه کاربری', bio: 'مطمئن می‌شود که هر سؤال دقیق، هر توضیح روشن و هر تعامل لذت‌بخش باشد.' },
  { avatar: 'av4', letter: 'ع', name: 'علی', role: 'متخصص هوش مصنوعی', bio: 'معلم هوشمند متاتست را آموزش داده و مطمئن شده که پاسخ‌ها دقیق، اخلاقی و مفید باشند.' },
];

const TIMELINE = [
  { side: 'tl-right', year: 'بهار ۱۴۰۲', title: 'ایده اولیه', desc: 'یک گفت‌وگوی ساده بین دو دوست: «چرا تمرین کردن این‌قدر کسل‌کننده است؟» — و از همین‌جا ایده متاتست متولد شد.' },
  { side: 'tl-left', year: 'تابستان ۱۴۰۲', title: 'اولین نسخه', desc: 'اولین پروتوتایپ با ۵۰۰ سؤال ریاضی به ۳۰ دانش‌آموز داده شد. نتایج و بازخوردها باورنکردنی بود.' },
  { side: 'tl-right', year: 'پاییز ۱۴۰۲', title: 'راه‌اندازی رسمی', desc: 'متاتست به صورت عمومی معرفی شد. در اولین ماه، بیش از ۱۰۰۰ کاربر مشتاق ثبت‌نام کردند.' },
  { side: 'tl-left', year: 'زمستان ۱۴۰۲', title: 'معلم هوشمند', desc: 'اولین نسخه معلم هوش‌مصنوعی راه‌اندازی شد — یک دستیار صبور که ۲۴ ساعته در دسترس دانش‌آموزان است.' },
  { side: 'tl-right', year: '۱۴۰۳ — امروز', title: '+۱۵ هزار کاربر', desc: 'امروز متاتست با بیش از ۱۵ هزار دانش‌آموز فعال، آزمون‌های رقابتی و پلن‌های متنوع با قدرت به جلو می‌رود.' },
];

export function AboutPage() {
  const href = appUrl();
  return (
    <PageField>
      <SiteHeader active="about" />
      <section className="about-hero">
        <div className="hero-eyebrow">داستان ما</div>
        <h1 className="about-title">متاتست چیست؟</h1>
        <p className="about-lead">ما یک تیم کوچک اما پرشور هستیم که باور داریم هر دانش‌آموزی — صرف‌نظر از شهر، مدرسه یا بودجه‌اش — حق دارد به بهترین ابزارهای یادگیری دسترسی داشته باشد.</p>
        <div className="hero-cta-row">
          <a href={href} className="btn-primary js-app">
            <BoltIcon />
            همین الان امتحان کن
          </a>
          <Link to="/blog/" className="btn-ghost">
            <BookIcon />
            بلاگ آموزشی
          </Link>
        </div>
      </section>
      <section className="stats-section">
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-num">+۱۵هزار</div><div className="stat-label">دانش‌آموز فعال که هر روز با متاتست تمرین می‌کنند</div></div>
          <div className="stat-card"><div className="stat-num">+۲۰۰هزار</div><div className="stat-label">سؤال تمرینی در پایه‌ها و دروس مختلف</div></div>
          <div className="stat-card"><div className="stat-num">+۵۰هزار</div><div className="stat-label">آزمون آنلاین رقابتی برگزار شده</div></div>
          <div className="stat-card"><div className="stat-num">۴.۸ ⭐</div><div className="stat-label">میانگین رضایت کاربران بر اساس نظرسنجی‌های ماهانه</div></div>
        </div>
      </section>
      <section className="story-section">
        <div className="story-inner">
          <div className="story-visual">
            <div className="story-visual-glow" />
            <div className="story-icon-center">
              <div className="story-ring">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
              </div>
            </div>
          </div>
          <div>
            <div className="sec-eyebrow">داستان شروع</div>
            <h2 className="sec-title">از یک ایده ساده تا یک پلتفرم</h2>
            <p className="sec-body">متاتست در سال ۱۴۰۲ با یک سؤال ساده شروع شد: چرا یادگیری باید خسته‌کننده باشد؟ ما می‌دیدیم که دانش‌آموزان ساعت‌ها پشت کتاب می‌نشینند اما پیشرفت واقعی نمی‌کنند. می‌دانستیم که راه بهتری وجود دارد.</p>
            <p className="sec-body" style={{ marginTop: 16 }}>تیم متاتست تصمیم گرفت ابزاری بسازد که تمرین روزانه را به یک تجربه لذت‌بخش تبدیل کند؛ جایی که آزمون‌های رقابتی، معلم هوش‌مصنوعی و تحلیل دقیق عملکرد، همه در یک جا باشند. نتیجه؟ متاتست.</p>
          </div>
        </div>
      </section>
      <AboutShowcases />
      <section className="values-section">
        <div className="section-head">
          <div className="sec-eyebrow">ارزش‌های ما</div>
          <h2 className="sec-title">چه چیزی ما را متفاوت می‌کند؟</h2>
        </div>
        <div className="values-grid">
          {VALUES.map((value) => (
            <div className="value-card" key={value.title}>
              <div className={`value-icon ${value.icon}`}>{value.svg}</div>
              <div className="value-title">{value.title}</div>
              <p className="value-desc">{value.desc}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="team-section">
        <div className="section-head" style={{ marginBottom: 60 }}>
          <div className="sec-eyebrow">تیم سازنده</div>
          <h2 className="sec-title">کی‌ها پشت متاتست هستند؟</h2>
        </div>
        <div className="team-grid">
          {TEAM.map((person) => (
            <div className="team-card" key={person.name}>
              <div className={`team-avatar ${person.avatar}`}>{person.letter}</div>
              <div className="team-name">{person.name}</div>
              <div className="team-role">{person.role}</div>
              <p className="team-bio">{person.bio}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="timeline-section">
        <div className="section-head" style={{ marginBottom: 70 }}>
          <div className="sec-eyebrow">مسیر رشد</div>
          <h2 className="sec-title">از شروع تا امروز</h2>
        </div>
        <div className="timeline">
          {TIMELINE.map((item) => (
            <div className={`tl-item ${item.side}`} key={item.year}>
              <div className="tl-dot" />
              <div className="tl-card">
                <span className="tl-year">{item.year}</span>
                <h3 className="tl-title">{item.title}</h3>
                <p className="tl-desc">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="cta-section">
        <div className="cta-card">
          <div className="cta-eyebrow">با ما بمان</div>
          <h2 className="cta-title">آماده‌ای بهتر شوی؟</h2>
          <p className="cta-desc">به هزاران دانش‌آموزی بپیوند که هر روز با متاتست تمرین می‌کنند و نتایج واقعی می‌گیرند.</p>
          <a href={href} className="btn-primary js-app" style={{ display: 'inline-flex', margin: '0 auto' }}>
            <BoltIcon />
            شروع رایگان
          </a>
        </div>
      </section>
      <SiteFooter variant="sub" />
    </PageField>
  );
}
