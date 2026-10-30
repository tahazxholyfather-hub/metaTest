import { useEffect, useState } from 'react';
import { appUrl } from '../lib/appUrl';
import { playLordIcon } from '../lib/lordicon';
import { faNum, planIconSrc, planPricing, type PublicPlan } from '../lib/plans';
import { LordIcon } from './LordIcon';

export function PlansSection() {
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [status, setStatus] = useState('در حال دریافت تعرفه‌ها…');

  useEffect(() => {
    let alive = true;
    fetch('/api/payments/plans')
      .then((res) => res.json())
      .then((payload: { success?: boolean; data?: PublicPlan[] }) => {
        if (!alive) return;
        if (!payload?.success || !Array.isArray(payload.data)) throw new Error('plans');
        setPlans(payload.data);
        setStatus(payload.data.length ? '' : 'فعلاً پلنی برای نمایش نیست.');
      })
      .catch(() => {
        if (alive) setStatus('دریافت تعرفه‌ها ممکن نشد. کمی بعد دوباره تلاش کنید.');
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    document.querySelectorAll('#plans-grid lord-icon').forEach((icon) => playLordIcon(icon));
  }, [plans]);

  return (
    <section className="plans-section reveal-section" id="plans">
      <div className="plans-inner glass-panel">
        <div className="plans-head">
          <div className="sec-eyebrow reveal-element stagger-1">اشتراک متاتست</div>
          <h2 className="sec-title shine-title reveal-element stagger-2">پلن‌ها و تعرفه‌ها</h2>
          <p className="sec-desc reveal-element stagger-3">قیمت‌ها همان پلن‌هایی هستند که داخل اپ، در ارتقا پلن، می‌بینید. با هر تغییری در پنل ادمین، این بخش هم عوض می‌شود.</p>
        </div>
        <div className="plans-grid" id="plans-grid">
          {(plans || []).map((plan) => {
            const view = planPricing(plan);
            const primary = plan.iconColors?.primary || '#F8F7FF';
            const secondary = plan.iconColors?.secondary || '#8b5cf6';
            const classes = ['plan-card', plan.popular ? 'popular' : '', view.locked ? 'locked' : ''].filter(Boolean).join(' ');
            return (
              <article className={classes} key={plan.id || plan.name}>
                {plan.popular ? <div className="plan-badge">پیشنهادی</div> : null}
                <div className="plan-icon">
                  <LordIcon src={planIconSrc(plan)} trigger="loop" colors={`primary:${primary},secondary:${secondary}`} />
                </div>
                <h3 className="plan-name">{plan.name}</h3>
                {view.compare != null ? <div className="plan-compare">{faNum(view.compare)} تومان</div> : null}
                <div className="plan-price">{faNum(view.finalPrice)} تومان</div>
                <div className="plan-meta">
                  {view.days}{view.discount > 0 ? ` · ${faNum(view.discount)}٪ تخفیف` : ''}
                </div>
                {plan.attributes?.length ? (
                  <ul className="plan-perks">
                    {plan.attributes.map((line) => <li key={line}>{line}</li>)}
                  </ul>
                ) : null}
                {view.locked
                  ? <span className="plan-cta disabled">فعلاً غیرفعال</span>
                  : <a className="plan-cta js-app" href={appUrl()}>ارتقا پلن</a>}
              </article>
            );
          })}
        </div>
        <p className="plans-status" id="plans-status">{status}</p>
      </div>
    </section>
  );
}
