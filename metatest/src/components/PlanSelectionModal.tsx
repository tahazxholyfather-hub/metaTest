import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, CreditCard, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { flowApi } from '../lib/authApi';
import { useUser } from '../context/UserContext';
import { ResponsiveModal } from './ResponsiveModal';
import { PlanRibbonBadge, durationTabLabel, equivalentPerDay, planBenefitLines, planTint, type ShopPlan } from './plan/PlanMarks';

type Plan = ShopPlan & {
    shimmerClass: string;
    activeBorder: string;
};

type CouponState = {
    code: string;
    percent: number;
};

interface PlanSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onActivated?: () => void;
}

function mapBackendPlan(plan: any): Plan {
    const name = plan.name || '';
    let shimmerClass = 'shimmer-silver';
    let activeBorder = 'border-slate-400/60';
    if (name.includes('برنز')) {
        shimmerClass = 'shimmer-bronze';
        activeBorder = 'border-[#cd7f32]/60';
    } else if (name.includes('طلا')) {
        shimmerClass = 'shimmer-golden';
        activeBorder = 'border-amber-500/60';
    } else if (name.includes('الماس') || name.includes('دیاموند')) {
        shimmerClass = 'shimmer-diamond';
        activeBorder = 'border-sky-500/60';
    }
    return {
        id: String(plan.id),
        name: plan.name,
        days: plan.unlimited === true || plan.days === null ? null : Number(plan.days || 30),
        unlimited: plan.unlimited === true || plan.days === null,
        purchasable: plan.purchasable !== false,
        loyaltyPercent: Number(plan.loyaltyPercent || 0),
        price: Number(plan.price || 0),
        comparePrice: plan.comparePrice ? Number(plan.comparePrice) : null,
        attributes: Array.isArray(plan.attributes) ? plan.attributes : [],
        iconKey: plan.iconKey || null,
        dailyCoins: plan.dailyCoins == null ? null : Number(plan.dailyCoins),
        savings: plan.savings?.amount ? { amount: Number(plan.savings.amount), versusName: String(plan.savings.versusName || '') } : null,
        popular: Boolean(plan.popular || plan.isPopular),
        iconColors: plan.iconColors,
        shimmerClass: plan.shimmerClass || shimmerClass,
        activeBorder: plan.activeBorder || activeBorder,
    };
}

function quote(plan: Plan | undefined, coupon: CouponState | null) {
    const pay = plan?.price || 0;
    const loyaltyPercent = plan?.loyaltyPercent || 0;
    const afterLoyalty = Math.max(0, pay - Math.round((pay * loyaltyPercent) / 100));
    const couponPercent = coupon?.percent || 0;
    const couponOff = Math.round((afterLoyalty * couponPercent) / 100);
    const finalPrice = Math.max(0, afterLoyalty - couponOff);
    const crossed = plan?.comparePrice && plan.comparePrice > pay ? plan.comparePrice : null;
    return { pay, crossed, loyaltyPercent, loyaltyOff: pay - afterLoyalty, couponPercent, couponOff, finalPrice };
}

function errorText(error: unknown, fallback: string) {
    return error instanceof Error && error.message ? error.message : fallback;
}

function useDesktop() {
    const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);
    useEffect(() => {
        const onResize = () => setDesktop(window.innerWidth >= 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return desktop;
}

function BenefitSlide({ lines }: { lines: string[] }) {
    const [index, setIndex] = useState(0);
    const extra = lines.length > 2;
    const signature = lines.join('\n');

    useEffect(() => {
        setIndex(0);
    }, [signature]);

    useEffect(() => {
        if (!extra) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) return;
        const id = window.setInterval(() => setIndex((value) => (value + 1) % lines.length), 2200);
        return () => window.clearInterval(id);
    }, [extra, lines.length, signature]);

    const shown = extra
        ? [0, 1].map((offset) => {
            const at = (index + offset) % lines.length;
            return { line: lines[at], at };
        })
        : lines.map((line, at) => ({ line, at }));

    return (
        <ul className={`w-full overflow-hidden text-right ${extra ? 'relative h-[3.15rem]' : 'space-y-1'}`}>
            <AnimatePresence mode="popLayout" initial={false}>
                {shown.map(({ line, at }) => (
                    <motion.li
                        layout
                        key={`${at}-${line}`}
                        initial={extra ? { opacity: 0, y: 12 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.28 }}
                        className="flex items-start gap-1.5 py-0.5 text-[12px] font-medium leading-5 text-[var(--text-primary)]"
                    >
                        <Check size={13} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={2.6} />
                        <span>{line}</span>
                    </motion.li>
                ))}
            </AnimatePresence>
        </ul>
    );
}

function PriceBlock({ plan }: { plan: Plan }) {
    const compare = plan.comparePrice && plan.comparePrice > plan.price ? plan.comparePrice : null;
    const offPercent = compare ? Math.round((1 - plan.price / compare) * 100) : 0;
    const daily = equivalentPerDay(plan.price, plan.days);
    return (
        <div className="flex flex-col items-center">
            <p className="flex items-baseline justify-center gap-1 text-[var(--text-primary)]">
                <span className="text-[18px] font-black leading-none tabular-nums">{plan.price.toLocaleString('fa-IR')}</span>
                <span className="text-[11px] font-bold text-[var(--text-secondary)]">تومان</span>
            </p>
            {(compare || plan.loyaltyPercent) ? (
                <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                    {compare && (
                        <span className="text-[11px] font-bold tabular-nums text-[var(--text-muted)] line-through">
                            {compare.toLocaleString('fa-IR')}
                        </span>
                    )}
                    {offPercent > 0 && (
                        <span className="text-[10px] font-black text-emerald-600">{offPercent.toLocaleString('fa-IR')}٪</span>
                    )}
                    {!!plan.loyaltyPercent && (
                        <span className="text-[10px] font-bold text-emerald-600">وفاداری {plan.loyaltyPercent.toLocaleString('fa-IR')}٪</span>
                    )}
                </div>
            ) : null}
            {daily != null && (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-primary)]">
                    <span>معادل</span>
                    <span className="tabular-nums">{daily.toLocaleString('fa-IR')}</span>
                    <span>تومان</span>
                </span>
            )}
        </div>
    );
}

export default function PlanSelectionModal({ isOpen, onClose, onActivated }: PlanSelectionModalProps) {
    const { user, setUser } = useUser();
    const desktop = useDesktop();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);
    const [plansError, setPlansError] = useState('');
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [discountCode, setDiscountCode] = useState('');
    const [couponData, setCouponData] = useState<CouponState | null>(null);
    const [couponError, setCouponError] = useState('');
    const [paymentError, setPaymentError] = useState('');
    const [walletError, setWalletError] = useState('');
    const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    const [payWithWallet, setPayWithWallet] = useState(false);
    const [walletBalance, setWalletBalance] = useState<number | null>(typeof user?.toman_balance === 'number' ? user.toman_balance : null);

    const visiblePlans = useMemo(() => plans.filter((plan) => plan.purchasable !== false), [plans]);
    const selectedPlan = visiblePlans.find((plan) => plan.id === selectedPlanId) || visiblePlans[0];
    const bill = useMemo(() => quote(selectedPlan, couponData), [selectedPlan, couponData]);
    const walletShown = walletBalance;
    const walletEmpty = walletShown === 0;

    const rememberWallet = (balance: number) => {
        setWalletBalance(balance);
        setWalletError('');
        setUser((prev) => (prev ? { ...prev, toman_balance: balance } : prev));
        if (balance <= 0) setPayWithWallet(false);
    };

    useEffect(() => {
        if (!isOpen) return;
        let alive = true;
        setIsLoadingPlans(true);
        setPlansError('');
        setWalletError('');
        flowApi.subscriptionPlans()
            .then((res) => {
                if (!alive) return;
                if (res.success && Array.isArray(res.data)) {
                    const formatted = res.data.map(mapBackendPlan);
                    setPlans(formatted);
                    const openPlans = formatted.filter((plan) => plan.purchasable !== false);
                    const next = openPlans.find((plan) => plan.popular) || openPlans[0];
                    setSelectedPlanId(next ? next.id : null);
                    setExpandedId(next ? next.id : null);
                } else {
                    setPlansError(res.message || 'لیست پلن‌ها دریافت نشد.');
                }
            })
            .catch((error) => {
                if (alive) setPlansError(errorText(error, 'لیست پلن‌ها دریافت نشد.'));
            })
            .finally(() => {
                if (alive) setIsLoadingPlans(false);
            });
        flowApi.getMyWallet()
            .then((res: any) => {
                if (!alive) return;
                if (res?.success) rememberWallet(Number(res.data?.balance ?? 0));
                else setWalletError(res?.message || 'کیف پول دریافت نشد.');
            })
            .catch((error) => {
                if (alive) setWalletError(errorText(error, 'کیف پول دریافت نشد.'));
            });
        return () => { alive = false; };
    }, [isOpen]);

    useEffect(() => {
        setCouponData(null);
        setCouponError('');
    }, [selectedPlanId]);

    const handleClose = () => {
        setDiscountCode('');
        setCouponData(null);
        setCouponError('');
        setPaymentError('');
        setPayWithWallet(false);
        onClose();
    };

    const handleApplyDiscount = async () => {
        const code = discountCode.trim();
        if (!code || !selectedPlan || isApplyingDiscount) return;
        setIsApplyingDiscount(true);
        setCouponError('');
        setCouponData(null);
        try {
            const res = await flowApi.validateSubscriptionDiscount({ code, planId: selectedPlan.id });
            if (!res?.success) {
                setCouponError(res?.message || 'این کد برای این پلن قبول نشد.');
                return;
            }
            const coupon = res.data?.coupon;
            const percent = Number(coupon?.percent || 0);
            if (!percent) {
                setCouponError(res.message || 'این کد برای این پلن قبول نشد.');
                return;
            }
            setCouponData({ code: coupon?.code || code, percent });
        } catch (error) {
            setCouponError(errorText(error, 'بررسی کد انجام نشد. دوباره امتحان کنید.'));
        } finally {
            setIsApplyingDiscount(false);
        }
    };

    const handlePay = async () => {
        if (!selectedPlan || isPaying) return;
        if (payWithWallet && walletEmpty) {
            setPaymentError('عدم موجودی');
            return;
        }
        const toastId = toast.loading('در حال ساخت پرداخت...');
        try {
            setIsPaying(true);
            setPaymentError('');
            const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ');
            const res = await flowApi.createSubscriptionPayment({
                planId: selectedPlan.id,
                discountCode: couponData?.code || undefined,
                paymentMethod: payWithWallet ? 'wallet' : undefined,
                metadata: {
                    userId: user?.id ? String(user.id) : undefined,
                    mobile: user?.phone,
                    email: user?.email || undefined,
                    username: user?.username,
                    name: fullName || undefined,
                },
            });
            if (!res?.success) {
                const errMsg = res?.message || 'پرداخت ساخته نشد.';
                setPaymentError(errMsg);
                toast.error(errMsg, { id: toastId });
                return;
            }
            if (res.data?.directActivated) {
                const queued = Boolean((res.data as { queued?: boolean }).queued);
                toast.success(res.message || (queued ? 'پلن در صف رزرو ماند.' : 'اشتراک فعال شد.'), { id: toastId });
                try {
                    const info = await flowApi.getUserInfo();
                    if (info?.success && info.data) setUser(info.data);
                } catch { /* next load refreshes the plan */ }
                try {
                    const walletRes: any = await flowApi.getMyWallet();
                    if (walletRes?.success) rememberWallet(Number(walletRes.data?.balance ?? 0));
                } catch { /* balance refreshes on the next open */ }
                onActivated?.();
                handleClose();
                return;
            }
            const gateway = res.data as { paymentUrl?: string; url?: string; redirectUrl?: string; gatewayUrl?: string } | undefined;
            const paymentUrl = gateway?.paymentUrl || gateway?.url || gateway?.redirectUrl || gateway?.gatewayUrl;
            if (paymentUrl) {
                toast.success('در حال رفتن به درگاه...', { id: toastId });
                window.location.href = paymentUrl;
                return;
            }
            setPaymentError('لینک پرداخت نیامد.');
            toast.error('لینک پرداخت نیامد.', { id: toastId });
        } catch (error) {
            const errMsg = errorText(error, 'اتصال به درگاه برقرار نشد.');
            setPaymentError(errMsg);
            toast.error(errMsg, { id: toastId });
        } finally {
            setIsPaying(false);
        }
    };

    const gridClass = visiblePlans.length <= 1
        ? 'mx-auto grid w-full max-w-sm grid-cols-1'
        : visiblePlans.length === 2
            ? 'grid grid-cols-2 gap-3'
            : 'grid grid-cols-3 gap-3';

    return (
        <ResponsiveModal
            isOpen={isOpen}
            onClose={handleClose}
            title="انتخاب اشتراک"
            maxWidthClass="md:w-[min(1080px,96vw)] md:max-w-[96vw]"
            footer={
                <div className="space-y-3" dir="rtl">
                    <div className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-2.5">
                        <div className="min-w-0">
                            <div className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--bg-element)] px-3 py-2">
                                <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-bold text-[var(--text-primary)]">
                                    <Wallet size={16} className="shrink-0 text-[var(--accent)]" />
                                    کیف پول
                                </span>
                                <span className="flex shrink-0 items-center gap-2">
                                    {walletShown == null ? (
                                        <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" />
                                    ) : walletEmpty ? (
                                        <span className="text-[11px] font-bold text-rose-600">عدم موجودی</span>
                                    ) : (
                                        <span className="text-[12px] font-black tabular-nums text-[var(--text-primary)]">
                                            {walletShown.toLocaleString('fa-IR')}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={payWithWallet}
                                        aria-label="پرداخت با کیف پول"
                                        disabled={walletEmpty || walletShown == null}
                                        onClick={() => setPayWithWallet((value) => !value)}
                                        className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full border-0 p-0 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${payWithWallet ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                                    >
                                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${payWithWallet ? 'left-0.5' : 'right-0.5'}`} />
                                    </button>
                                </span>
                            </div>
                            {walletError && <p className="mt-1 text-[11px] font-bold leading-4 text-rose-600">{walletError}</p>}
                        </div>
                        <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-1 rounded-2xl bg-[var(--bg-element)] py-1 pe-1 ps-2">
                                <input
                                    type="text"
                                    value={discountCode}
                                    onChange={(event) => {
                                        setDiscountCode(event.target.value);
                                        setCouponError('');
                                        if (couponData && event.target.value.trim() !== couponData.code) setCouponData(null);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') handleApplyDiscount();
                                    }}
                                    placeholder="کد تخفیف"
                                    disabled={!selectedPlan || isApplyingDiscount}
                                    className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-[12px] shadow-none outline-none ring-0 focus:border-transparent focus:shadow-none focus-visible:border-transparent focus-visible:shadow-none focus-visible:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={handleApplyDiscount}
                                    disabled={!discountCode.trim() || isApplyingDiscount || !selectedPlan}
                                    className="inline-flex h-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2.5 py-0 text-[11px] font-black text-[var(--accent)] disabled:opacity-40"
                                >
                                    {isApplyingDiscount ? <Loader2 size={13} className="animate-spin" /> : 'اعمال'}
                                </button>
                            </div>
                            {couponError && <p className="mt-1 text-[11px] font-bold leading-4 text-rose-600">{couponError}</p>}
                            {!couponError && couponData && (
                                <p className="mt-1 text-[11px] font-bold leading-4 text-emerald-600">{couponData.percent.toLocaleString('fa-IR')}٪ کم شد</p>
                            )}
                        </div>
                    </div>
                    {paymentError && <p className="text-[11px] font-bold leading-4 text-rose-600">{paymentError}</p>}
                    <div className="grid grid-cols-2 items-center gap-2.5">
                        <div className="flex justify-start">
                            <button
                                type="button"
                                onClick={handlePay}
                                disabled={isPaying || !selectedPlan || isLoadingPlans}
                                className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[var(--accent)] px-5 py-0 text-[13px] font-bold text-white disabled:opacity-40"
                            >
                                {isPaying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                                پرداخت
                            </button>
                        </div>
                        <p className="flex items-baseline justify-end gap-1 text-[var(--text-primary)]" aria-label="مبلغ قابل پرداخت">
                            <span className="text-[20px] font-black leading-none tabular-nums md:text-[26px]">
                                {(selectedPlan ? bill.finalPrice : 0).toLocaleString('fa-IR')}
                            </span>
                            <span className="text-[12px] font-bold text-[var(--text-muted)]">تومان</span>
                        </p>
                    </div>
                </div>
            }
        >
            <div className="md:flex md:h-full md:min-h-0 md:flex-col" dir="rtl">
                {plansError && <p className="mb-3 text-center text-[12px] font-bold text-rose-600">{plansError}</p>}
                {isLoadingPlans ? (
                    <div className="flex min-h-[220px] items-center justify-center">
                        <Loader2 className="animate-spin text-[var(--accent)]" />
                    </div>
                ) : visiblePlans.length === 0 ? (
                    <p className="py-16 text-center text-[13px] text-[var(--text-muted)]">الان پلنی برای خرید باز نیست.</p>
                ) : desktop ? (
                    <div className={gridClass}>
                        {visiblePlans.map((plan) => {
                            const selected = plan.id === selectedPlan?.id;
                            const tint = planTint(plan.id, plan.name, plan.iconColors?.primary);
                            const lines = planBenefitLines(plan).filter((line) => !line.includes('کمتر از قیمت اصلی'));
                            const shine = { '--shine': tint } as CSSProperties;
                            return (
                                <button
                                    key={plan.id}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => setSelectedPlanId(plan.id)}
                                    className="flex h-full min-h-0 cursor-pointer flex-col items-center overflow-hidden rounded-3xl border bg-transparent px-3 py-3 text-center"
                                    style={{ borderColor: tint, borderWidth: selected ? 2 : 1 }}
                                >
                                    {plan.popular && (
                                        <span className="mb-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-white">محبوب</span>
                                    )}
                                    <PlanRibbonBadge planId={plan.id} name={plan.name} color={tint} size={52} playKey={`offer-${plan.id}`} />
                                    <h3 className="plan-title-shine mt-1 text-[18px] font-black leading-none" style={shine}>{plan.name}</h3>
                                    <p className="mt-1 text-[10px] font-bold text-[var(--text-muted)]">{durationTabLabel(plan.days, plan.unlimited)}</p>
                                    <div className="mt-2">
                                        <PriceBlock plan={plan} />
                                    </div>
                                    <div className="mt-2 w-full min-h-0 flex-1">
                                        <BenefitSlide lines={lines} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {visiblePlans.map((plan) => {
                            const selected = plan.id === selectedPlan?.id;
                            const open = expandedId === plan.id;
                            const tint = planTint(plan.id, plan.name, plan.iconColors?.primary);
                            const lines = planBenefitLines(plan).filter((line) => !line.includes('کمتر از قیمت اصلی'));
                            const shine = { '--shine': tint } as CSSProperties;
                            return (
                                <div
                                    key={plan.id}
                                    className="overflow-hidden rounded-2xl border bg-transparent"
                                    style={{ borderColor: tint, borderWidth: selected ? 2 : 1 }}
                                >
                                    <button
                                        type="button"
                                        aria-expanded={open}
                                        onClick={() => {
                                            setSelectedPlanId(plan.id);
                                            setExpandedId((current) => current === plan.id ? null : plan.id);
                                        }}
                                        className="flex w-full cursor-pointer items-center justify-between gap-3 bg-transparent px-3 py-3 text-right"
                                    >
                                        <span className="flex min-w-0 items-center gap-2">
                                            <PlanRibbonBadge planId={plan.id} name={plan.name} color={tint} size={40} playKey={`sheet-${plan.id}`} />
                                            <span className="min-w-0 text-right">
                                                <span className="plan-title-shine block truncate text-[15px] font-black leading-none" style={shine}>{plan.name}</span>
                                                <span className="mt-1 block text-[10px] font-bold text-[var(--text-muted)]">{durationTabLabel(plan.days, plan.unlimited)}</span>
                                            </span>
                                        </span>
                                        <span className="flex shrink-0 items-center gap-1.5">
                                            <span className="text-left">
                                                <span className="block text-[14px] font-black tabular-nums leading-none text-[var(--text-primary)]">{plan.price.toLocaleString('fa-IR')}</span>
                                                <span className="mt-1 block text-[10px] font-bold text-[var(--text-muted)]">تومان</span>
                                            </span>
                                            <ChevronDown size={16} className={`text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
                                        </span>
                                    </button>
                                    <AnimatePresence initial={false}>
                                        {open && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                                                className="overflow-hidden"
                                            >
                                                <div className="space-y-2 px-3 pb-3">
                                                    <PriceBlock plan={plan} />
                                                    <ul className="space-y-1 text-right">
                                                        {lines.map((line) => (
                                                            <li key={line} className="flex items-start gap-1.5 text-[12px] font-medium leading-5 text-[var(--text-primary)]">
                                                                <Check size={13} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={2.6} />
                                                                <span>{line}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </ResponsiveModal>
    );
}
