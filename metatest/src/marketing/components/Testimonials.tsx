type Card = {
  letter: string;
  avatar: string;
  name: string;
  grade: string;
  stars: number;
  text: string;
};

const STAR = 'M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.3l7.1-.7z';

const ROW_A: Card[] = [
  { letter: 'ع', avatar: 'av-1', name: 'علی رضایی', grade: 'پایه دوازدهم — تجربی', stars: 5, text: 'تحلیل‌های متاتست دقیقاً بهم نشون داد کجای زیست ضعف دارم. بعد از یک ماه تمرین هدفمند، درصدم توی آزمون‌های آزمایشی ۲۰ درصد بالا رفت!' },
  { letter: 'س', avatar: 'av-2', name: 'سارا محمدی', grade: 'پایه یازدهم — ریاضی', stars: 4, text: 'محیطش انقدر شبیه بازیه که اصلاً حس درس خوندن ندارم! هر شب با دوستام مسابقه می‌ذاریم و بدون اینکه بفهمیم کلی تست حل می‌کنیم.' },
  { letter: 'ا', avatar: 'av-3', name: 'امیرحسین کریمی', grade: 'کنکوری — تجربی', stars: 5, text: 'معلم هوش مصنوعی متاتست ساعت ۲ نصفه‌شب هم جواب سوالای فیزیکمو می‌ده! دیگه لازم نیست تا کلاس بعدی صبر کنم تا اشکالمو بپرسم.' },
  { letter: 'ن', avatar: 'av-4', name: 'نگین احمدی', grade: 'پایه دهم — تجربی', stars: 5, text: 'اینکه می‌تونم دقیقاً فصل و مبحثی که می‌خوام رو انتخاب کنم عالیه. شیمی رو فصل به فصل با متاتست جلو رفتم و الان از کلاسم جلوترم.' },
];

const ROW_B: Card[] = [
  { letter: 'م', avatar: 'av-2', name: 'محمد قاسمی', grade: 'پایه دوازدهم — ریاضی', stars: 5, text: 'نمودارهای پیشرفتش واقعاً انگیزه‌بخشه. هر هفته می‌بینم چقدر بهتر شدم و همین باعث می‌شه ادامه بدم. حسابان رو کاملاً با متاتست جمع کردم.' },
  { letter: 'ف', avatar: 'av-3', name: 'فاطمه حسینی', grade: 'پایه یازدهم — تجربی', stars: 5, text: 'قبلاً از فیزیک فرار می‌کردم ولی الان هر روز خودم می‌رم سراغش! وقتی جواب اشتباه می‌دم هوش مصنوعی قدم به قدم توضیح می‌ده کجا اشتباه کردم.' },
  { letter: 'پ', avatar: 'av-4', name: 'پارسا نوری', grade: 'پایه دهم — ریاضی', stars: 4, text: 'آزمون‌های رقابتیش فوق‌العادست. با بچه‌های کل کشور مسابقه می‌دم و رتبه‌م رو لحظه‌ای می‌بینم. حس المپیاد رو توی خونه دارم!' },
  { letter: 'ی', avatar: 'av-1', name: 'یاسمن عزیزی', grade: 'کنکوری — هنر', stars: 5, text: 'رابط کاربریش از هر اپ خارجی که دیدم قشنگ‌تره. همه‌چیز روون و سریعه و برنامه مطالعه‌م رو کاملاً بر اساس تحلیل‌های متاتست چیدم.' },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="t-stars">
      {Array.from({ length: 5 }, (_, index) => (
        <svg key={index} className={index >= count ? 'off' : undefined} viewBox="0 0 24 24" fill="currentColor">
          <path d={STAR} />
        </svg>
      ))}
    </div>
  );
}

function CardView({ card }: { card: Card }) {
  return (
    <div className="t-card">
      <div className="t-head">
        <div className={`t-avatar ${card.avatar}`}>{card.letter}</div>
        <div className="t-meta">
          <div className="t-name">{card.name}</div>
          <div className="t-grade">{card.grade}</div>
        </div>
        <Stars count={card.stars} />
      </div>
      <p className="t-text">{card.text}</p>
    </div>
  );
}

function Marquee({ cards, reverse }: { cards: Card[]; reverse?: boolean }) {
  const groups = [false, true];
  return (
    <div className={reverse ? 'marquee-row reverse' : 'marquee-row'}>
      <div className="marquee-track">
        {groups.map((hidden) => (
          <div className="marquee-group" aria-hidden={hidden || undefined} key={hidden ? 'copy' : 'live'}>
            {cards.map((card) => <CardView key={`${hidden ? 'c' : 'l'}-${card.name}`} card={card} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="testimonials-section reveal-section">
      <div className="testimonials-head glass-panel">
        <div className="sec-eyebrow reveal-element stagger-1">نظرات دانش‌آموزان</div>
        <h2 className="sec-title shine-title reveal-element stagger-2">دانش‌آموزان چه می‌گویند؟</h2>
        <p className="sec-desc reveal-element stagger-3">تجربه واقعی کسانی که هر روز با متاتست درس می‌خوانند، تمرین می‌کنند و پیشرفت می‌کنند.</p>
      </div>
      <div className="reveal-element stagger-2">
        <Marquee cards={ROW_A} />
        <Marquee cards={ROW_B} reverse />
      </div>
    </section>
  );
}
