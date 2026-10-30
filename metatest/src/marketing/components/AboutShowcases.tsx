import metShot from '../assets/met.png';
import practiceShot from '../assets/practice.png';
import customA from '../assets/custom-a.png';
import customB from '../assets/custom-b.png';
import handmadeA from '../assets/handmade-a.png';
import handmadeB from '../assets/handmade-b.png';

function PhoneFrame({ src, alt, compact }: { src: string; alt: string; compact?: boolean }) {
  return (
    <div className={compact ? 'phone-stage compact' : 'phone-stage'}>
      <div className="phone-glow" />
      <div className="phone-frame">
        <div className="phone-notch" />
        <div className="phone-screen">
          <img src={src} className="phone-screen-img" alt={alt} />
        </div>
      </div>
    </div>
  );
}

export function AboutShowcases() {
  return (
    <>
      <section className="showcase-section">
        <div className="showcase-row">
          <div className="showcase-copy">
            <div className="sec-eyebrow">مت و هوش مصنوعی</div>
            <h2 className="sec-title">معلم خصوصی، همین کنار دستت</h2>
            <p className="sec-body">مت معلم هوشمند متاتست است. درس را انتخاب کن و آزاد حرف بزن، یا از او برنامه مطالعه، حل مرحله‌به‌مرحله، مرور و فهم مفهوم بخواه. هر وقت سؤال داشتی، حتی نیمه‌شب، مت همان‌جاست.</p>
          </div>
          <PhoneFrame src={metShot} alt="گفتگوی مت، معلم هوشمند متاتست" />
        </div>
      </section>

      <section className="showcase-section">
        <div className="showcase-row reverse">
          <div className="showcase-copy">
            <div className="sec-eyebrow">تمرین</div>
            <h2 className="sec-title">تمرین بر اساس نیاز</h2>
            <p className="sec-body">پایه، درس، فصل و مبحث را خودت انتخاب کن و فقط همان را تمرین کن. اگر خواستی با بقیه رقابت کنی، از همین صفحه وارد لابی آنلاین شو.</p>
          </div>
          <PhoneFrame src={practiceShot} alt="صفحه تمرین بر اساس نیاز" />
        </div>
      </section>

      <section className="showcase-section">
        <div className="showcase-duo">
          <PhoneFrame compact src={customA} alt="آزمون سفارشی در حال پاسخ" />
          <div className="showcase-copy">
            <div className="sec-eyebrow">آزمون سفارشی</div>
            <h2 className="sec-title">آزمونی که خودت سفارش می‌دهی</h2>
            <p className="sec-body">درس، فصل و سطح را مشخص کن تا متاتست یک آزمون مخصوص تو بچیند. وسط آزمون سؤال را می‌خوانی، گزینه را می‌زنی و همان لحظه جلو می‌روی.</p>
          </div>
          <PhoneFrame compact src={customB} alt="سؤال‌های آزمون سفارشی" />
        </div>
      </section>

      <section className="showcase-section">
        <div className="showcase-duo">
          <PhoneFrame compact src={handmadeA} alt="فیلتر ساخت آزمون دست‌ساز" />
          <div className="showcase-copy">
            <div className="sec-eyebrow">آزمون دست‌ساز</div>
            <h2 className="sec-title">سؤال‌ها را خودت برمی‌داری</h2>
            <p className="sec-body">از بانک تست، با فیلتر درس، پایه، فصل، مبحث و سطح، دقیقاً سؤال‌هایی را که می‌خواهی جدا کن و آزمون خودت را بچین.</p>
          </div>
          <PhoneFrame compact src={handmadeB} alt="انتخاب سؤال از بانک تست" />
        </div>
      </section>
    </>
  );
}
