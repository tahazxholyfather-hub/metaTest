import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Coins, Flame, Infinity as InfinityIcon, Sparkles, Tag } from 'lucide-react';
import { PlanRibbonBadge, planTint } from '../../components/plan/PlanMarks';
import { appUrl } from '../lib/appUrl';
import { faNum, planPricing, type PublicPlan } from '../lib/plans';

export function PlansSection() {
  const viewportRef = useRef<HTMLDivElement>(null);
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

  function move(direction: 1 | -1) {
    const root = viewportRef.current;
    if (!root) return;
    const card = root.querySelector<HTMLElement>('.plan-card');
    const distance = (card?.getBoundingClientRect().width || root.clientWidth) + 16;
    const sign = getComputedStyle(root).direction === 'rtl' ? -1 : 1;
    root.scrollBy({ left: direction * distance * sign, behavior: 'smooth' });
  }

  const cards = plans || [];

  return (
    <section className="plans-section" id="plans" aria-labelledby="plans-title">
      <div className="plans-head">
        <p className="plans-kicker">
          <Sparkles size={14} strokeWidth={1.75} aria-hidden="true" />
          پلن‌های اشتراک
        </p>
        <h2 id="plans-title">انتخاب <em>پلن دلخواه</em> شما</h2>
        <p>با اشتراک‌های متنوع متاتست، تجربه‌ای بهتر و کامل‌تر داشته باشید.</p>
      </div>
      {cards.length === 0 ? <p className="plans-status">{status}</p> : (
        <div className="plans-row">
          <button type="button" className="plans-arrow" aria-label="پلن قبلی" onClick={() => move(-1)}>
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <div className="plans-viewport" ref={viewportRef}>
            <div className="plans-track">
              {cards.map((plan) => {
                const view = planPricing(plan);
                const tint = planTint(plan.id, plan.name, plan.iconColors?.primary);
                const classes = ['plan-card', plan.popular ? 'is-popular' : '', view.locked ? 'locked' : ''].filter(Boolean).join(' ');
                return (
                  <article className={classes} key={plan.id || plan.name} style={{ '--tone': tint } as CSSProperties}>
                    {plan.popular ? (
                      <span className="plan-hot">
                        <Flame size={13} strokeWidth={1.75} aria-hidden="true" />
                        محبوب‌ترین
                      </span>
                    ) : null}
                    <div className="plan-medal" aria-hidden="true">
                      <PlanRibbonBadge planId={plan.id} name={plan.name} color={tint} size={96} playKey={plan.id || plan.name} />
                    </div>
                    <h3 className="plan-name">{plan.name}</h3>
                    <p className="plan-price">
                      {view.compare != null ? <s>{faNum(view.compare)}</s> : null}
                      <b>{faNum(view.finalPrice)}</b>
                      <span>تومان</span>
                    </p>
                    <p className="plan-meta">
                      <span>
                        {view.days === 'نامحدود' ? <InfinityIcon size={14} strokeWidth={1.75} aria-hidden="true" /> : <CalendarDays size={14} strokeWidth={1.75} aria-hidden="true" />}
                        {view.days === 'نامحدود' ? 'دسترسی نامحدود' : view.days}
                      </span>
                      {plan.dailyCoins ? (
                        <span>
                          <Coins size={14} strokeWidth={1.75} aria-hidden="true" />
                          روزانه {faNum(plan.dailyCoins)} سکه
                        </span>
                      ) : null}
                    </p>
                    {plan.savings && Number(plan.savings.amount) > 0 ? (
                      <p className="plan-save">
                        <Tag size={13} strokeWidth={1.75} aria-hidden="true" />
                        صرفه‌جویی {faNum(Number(plan.savings.amount))} تومان
                      </p>
                    ) : null}
                    {(plan.attributes || []).slice(0, 3).map((line) => <p className="plan-note" key={line}>{line}</p>)}
                    {view.locked
                      ? <button type="button" className="plan-cta" disabled>فعلاً بسته است</button>
                      : (
                        <a className="plan-cta" href={appUrl()}>
                          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                          انتخاب پلن
                        </a>
                      )}
                  </article>
                );
              })}
            </div>
          </div>
          <button type="button" className="plans-arrow" aria-label="پلن بعدی" onClick={() => move(1)}>
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
