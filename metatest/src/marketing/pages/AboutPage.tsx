import { appUrl } from '../lib/appUrl';
import { BoltIcon } from '../components/icons';
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
  {
    avatar: 'av1',
    letter: 'ط',
    name: 'طاها',
    role: 'بنیان‌گذار، مدیرعامل و مدیر محصول',
    study: 'دانشجوی دندان‌پزشکی',
    bio: 'ایده‌پرداز و هدایت‌کننده مسیر متاتست؛ کسی که با ترکیب نگاه کسب‌وکاری، شناخت نیازهای دانش‌آموزان و علاقه به تکنولوژی، مسیر توسعه متاتست رو شکل می‌ده.',
  },
  {
    avatar: 'av2',
    letter: 'ا',
    name: 'امیرحسین',
    role: 'مدیر تیم فنی و توسعه‌دهنده نرم‌افزار',
    study: 'دانشجوی مهندسی کامپیوتر',
    bio: 'مسئول تبدیل ایده‌های متاتست به یک محصول واقعی و کاربردی. از معماری فنی گرفته تا توسعه و بهینه‌سازی پلتفرم، تمرکزش روی ساخت تجربه‌ای سریع، پایدار و قابل اعتماد برای کاربرانه.',
  },
  {
    avatar: 'av3',
    letter: 'م',
    name: 'مهدی',
    role: 'مدیر منابع انسانی و مسئول محتوای آموزشی',
    study: 'دانشجوی پزشکی | دبیر برتر زیست‌شناسی',
    bio: 'پل ارتباطی بین دنیای آموزش و تیم متاتست. مسئولیت مدیریت منابع انسانی و نظارت بر محتوای آموزشی رو بر عهده داره تا مطمئن بشیم کیفیت آموزش، یکی از اصلی‌ترین استانداردهای متاتست باقی می‌مونه.',
  },
  {
    avatar: 'av4',
    letter: 'ا',
    name: 'امین',
    role: 'مدیر مالی و مدیر بازاریابی',
    study: '',
    bio: 'مسئول برنامه‌ریزی مالی، مدیریت منابع و توسعه بازار متاتست. تمرکزش روی ایجاد مسیرهای رشد، گسترش همکاری‌ها و تبدیل متاتست به یک برند شناخته‌شده در فضای آموزش کشوره.',
  },
];

const TIMELINE = [
  {
    side: 'tl-right',
    year: 'بهار ۱۴۰۴',
    title: 'جرقه یک ایده',
    lead: 'همه‌چیز از یک سؤال شروع شد!',
    desc: 'طاها، بنیان‌گذار متاتست، با بررسی چالش‌های دانش‌آموزان در مسیر یادگیری به یک ایده رسید: چرا هر دانش‌آموز نباید یک معلم خصوصی هوشمند و یک مجموعه کامل از ابزارهای آموزشی رو همیشه در دسترس داشته باشه؟ ایده‌ای که در ابتدا فقط یک دغدغه بود، کم‌کم به چشم‌انداز ساخت یک پلتفرم آموزشی متفاوت تبدیل شد.',
  },
  {
    side: 'tl-left',
    year: 'تابستان ۱۴۰۴',
    title: 'شکل‌گیری تیم',
    lead: 'یک ایده، چند ذهن خلاق، یک هدف مشترک!',
    desc: 'برای تبدیل ایده به واقعیت، طاها شروع به تشکیل تیم کرد. با پیوستن نیروهایی از حوزه‌های پزشکی، آموزش و مهندسی کامپیوتر، هسته اولیه متاتست شکل گرفت. از همین‌جا مسیر طراحی و توسعه یک تجربه آموزشی متفاوت آغاز شد.',
  },
  {
    side: 'tl-right',
    year: 'زمستان ۱۴۰۴',
    title: 'تولد نسخه اولیه',
    lead: 'اولین قدم برای تغییر تجربه یادگیری!',
    desc: 'بعد از ماه‌ها برنامه‌ریزی و توسعه، اولین نسخه متاتست شکل گرفت. تمرکز تیم روی ساخت یک بانک تست استاندارد، سیستم تمرین و بستری برای استفاده از هوش مصنوعی در فرآیند یادگیری بود. هدف این بود که دانش‌آموز فقط جواب سؤال رو پیدا نکنه، بلکه دلیل درست بودن جواب رو هم یاد بگیره.',
  },
  {
    side: 'tl-left',
    year: 'تابستان ۱۴۰۵',
    title: 'هوشمندتر از همیشه',
    lead: 'یک معلم خصوصی، همیشه در دسترس!',
    desc: 'در این مرحله، توسعه معلم هوشمند متاتست به یکی از اصلی‌ترین اولویت‌های تیم تبدیل شد. قابلیت رفع اشکال هوشمند با هدف پاسخ‌گویی به سؤالات دانش‌آموزان، بررسی سؤالات تصویری و کمک به یادگیری عمیق‌تر توسعه پیدا کرد. حالا متاتست چیزی فراتر از یک بانک تست بود؛ یک همراه هوشمند برای مسیر یادگیری!',
  },
  {
    side: 'tl-right',
    year: 'مهر ۱۴۰۵',
    title: 'آغاز رسمی متاتست',
    lead: 'از یک ایده تا شروع یک مسیر بزرگ!',
    desc: 'بعد از ماه‌ها طراحی، برنامه‌ریزی و توسعه، متاتست رسماً فعالیت خودش رو آغاز کرد. حالا دانش‌آموزان می‌تونن به مجموعه‌ای از سؤالات گلچین‌شده، ابزارهای تمرینی و معلم هوشمند ۲۴ ساعته دسترسی داشته باشن. اما برای ما این تازه شروع ماجراست؛ چون هدفمون ساختن آینده‌ای متفاوت برای یادگیریه.',
  },
];

export function AboutPage() {
  const href = appUrl();
  return (
    <PageField>
      <SiteHeader active="about" />
      <section className="about-hero">
        <div className="hero-eyebrow">درباره متاتست</div>
        <h1 className="about-title">متاتست چیه؟</h1>
        <div className="about-copy">
          <p className="about-lead">ما یه تیم پرانرژی هستیم که به هدف بزرگ داریم: تغییر تجربه یادگیری! باور داریم هر دانش‌آموز، فارغ از اینکه کجا زندگی می‌کنه یا چقدر بودجه داره، باید به بهترین ابزارهای آموزشی دسترسی داشته باشه.</p>
          <p className="about-lead">برای همین متاتست رو ساختیم؛ ترکیبی از هوش مصنوعی، آموزش هوشمند و ابزارهای حرفه‌ای که قراره مسیر درس خوندن رو برات ساده‌تر، جذاب‌تر و پربازده‌تر کنه.</p>
        </div>
        <div className="hero-cta-row">
          <a href={href} className="btn-primary js-app">
            <BoltIcon />
            همین الان امتحان کن
          </a>
          <a href="#about-features" className="btn-ghost">آشنایی با امکانات</a>
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
            <h2 className="sec-title">از یک دغدغه ساده تا یک ایده بزرگ!</h2>
            <p className="sec-body">همه‌چیز از یک سؤال ساده شروع شد:</p>
            <p className="story-quote">چرا با وجود این همه پیشرفت تکنولوژی، هنوز یادگیری برای خیلی از دانش‌آموزها به کتاب، جزوه و کلاس محدود شده؟</p>
            <p className="sec-body">ما از نزدیک با دنیای آموزش آشنا بودیم. می‌دیدیم دانش‌آموزها ساعت‌ها برای حل یک سؤال وقت می‌ذارن، گاهی به جواب سؤالاتشون نمی‌رسن و برای رفع کوچک‌ترین اشکالاتشون به معلم یا کلاس خصوصی وابسته می‌شن.</p>
            <p className="sec-body">طاها، بنیان‌گذار متاتست، با همین دغدغه تصمیم گرفت ایده‌ای رو دنبال کنه که بتونه تجربه یادگیری دانش‌آموزها رو متحول کنه؛ پلتفرمی که در اون تکنولوژی فقط یک ابزار جانبی نباشه، بلکه به بخشی از فرآیند یادگیری تبدیل بشه.</p>
            <p className="sec-body">این ایده کم‌کم به یک تیم تبدیل شد؛ تیمی متشکل از دانشجویان حوزه پزشکی، دندان‌پزشکی و کامپیوتر که هر کدوم از زاویه تخصص خودشون برای ساختن یک تجربه آموزشی متفاوت کنار هم قرار گرفتن.</p>
            <p className="sec-body">امروز متاتست فقط یک بانک سؤال نیست؛ ما داریم بستری می‌سازیم که در اون هوش مصنوعی نقش یک معلم خصوصی همیشه در دسترس رو بازی می‌کنه، دانش‌آموز می‌تونه هر سؤالی رو مطرح کنه و یادگیری رو با سرعت و روش خودش پیش ببره.</p>
            <p className="sec-body">ما هنوز اول راهیم؛ اما برای ساختن آینده‌ای بهتر برای آموزش، جدی هستیم.</p>
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
          <div className="sec-eyebrow">تیم متاتست</div>
          <h2 className="sec-title">معرفی تیم متاتست</h2>
        </div>
        <div className="team-grid">
          {TEAM.map((person) => (
            <div className="team-card" key={person.name}>
              <div className={`team-avatar ${person.avatar}`}>{person.letter}</div>
              <div className="team-name">{person.name}</div>
              <div className="team-role">{person.role}</div>
              {person.study ? <div className="team-study">{person.study}</div> : null}
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
                <p className="tl-lead">{item.lead}</p>
                <p className="tl-desc">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="cta-section">
        <div className="cta-card">
          <h2 className="cta-title">آینده یادگیری از همین‌جا شروع می‌شه!</h2>
          <p className="cta-desc">ما متاتست رو ساختیم تا یادگیری محدود به زمان کلاس و حضور معلم نباشه. حالا نوبت توئه که با کمک ابزارهای هوشمند، مسیر پیشرفتت رو متفاوت بسازی.</p>
          <a href={href} className="btn-primary js-app" style={{ display: 'inline-flex', margin: '0 auto' }}>
            <BoltIcon />
            به خانواده متاتست بپیوند!
          </a>
        </div>
      </section>
      <SiteFooter variant="sub" />
    </PageField>
  );
}
