import { useEffect, useMemo, useState } from 'react';
import { Check, CreditCard, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { flowApi } from '../lib/authApi';
import { useUser } from '../context/UserContext';
import { ResponsiveModal } from './ResponsiveModal';
import { PlanRibbonBadge, durationTabLabel, equivalentPerDay, planBenefitLines, planShimmerClass, planTint, type ShopPlan } from './plan/PlanMarks';

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

export default function PlanSelectionModal({ isOpen, onClose, onActivated }: PlanSelectionModalProps) {
    const { user, setUser } = useUser();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);
    const [plansError, setPlansError] = useState('');
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [discountCode, setDiscountCode] = useState('');
    const [couponData, setCouponData] = useState<CouponState | null>(null);
    const [couponError, setCouponError] = useState('');
    const [paymentError, setPaymentError] = useState('');
    const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    const [payWithWallet, setPayWithWallet] = useState(false);
    const [walletBalance, setWalletBalance] = useState<number | null>(user?.toman_balance ?? null);

    const visiblePlans = useMemo(() => plans.filter((plan) => plan.purchasable !== false), [plans]);
    const selectedPlan = visiblePlans.find((plan) => plan.id === selectedPlanId) || visiblePlans[0];
    const bill = useMemo(() => quote(selectedPlan, couponData), [selectedPlan, couponData]);

    useEffect(() => {
        if (!isOpen) return;
        let alive = true;
        setIsLoadingPlans(true);
        setPlansError('');
        flowApi.subscriptionPlans()
            .then((res) => {
                if (!alive) return;
                if (res.success && Array.isArray(res.data)) {
                    const formatted = res.data.map(mapBackendPlan);
                    setPlans(formatted);
                    const openPlans = formatted.filter((plan) => plan.purchasable !== false);
                    const next = openPlans.find((plan) => plan.popular) || openPlans[0];
                    setSelectedPlanId(next ? next.id : null);
                } else {
                    setPlansError(res.message || 'لیست پلن‌ها دریافت نشد.');
                }
            })
            .catch(() => {
                if (alive) setPlansError('لیست پلن‌ها دریافت نشد.');
            })
            .finally(() => {
                if (alive) setIsLoadingPlans(false);
            });
        flowApi.getMyWallet()
            .then((res: any) => {
                if (alive && res?.success) setWalletBalance(Number(res.data?.balance || 0));
            })
            .catch(() => undefined);
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
        } catch {
            setCouponError('بررسی کد انجام نشد. دوباره امتحان کنید.');
        } finally {
            setIsApplyingDiscount(false);
        }
    };

    const handlePay = async () => {
        if (!selectedPlan || isPaying) return;
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
            const errMsg = error instanceof Error && error.message ? error.message : 'اتصال به درگاه برقرار نشد.';
            setPaymentError(errMsg);
            toast.error(errMsg, { id: toastId });
        } finally {
            setIsPaying(false);
        }
    };

    const walletShown = walletBalance ?? user?.toman_balance ?? 0;
    const gridClass = visiblePlans.length <= 1
        ? 'mx-auto grid max-w-sm grid-cols-1'
        : visiblePlans.length === 2
            ? 'grid grid-cols-1 gap-3 md:grid-cols-2'
            : 'grid grid-cols-1 gap-3 md:grid-cols-3';

    return (
        <ResponsiveModal
            isOpen={isOpen}
            onClose={handleClose}
            title="انتخاب اشتراک"
            maxWidthClass="md:w-[min(1080px,96vw)] md:max-w-[96vw]"
            footer={
                <div className="space-y-3" dir="rtl">
                    <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex min-w-0 items-center justify-between gap-2 rounded-2xl bg-[var(--bg-element)] px-2.5 py-2">
                            <span className="flex min-w-0 items-center gap-1.5">
                                <Wallet size={16} className="shrink-0 text-[var(--accent)]" />
                                <span className="min-w-0 text-right">
                                    <span className="block truncate text-[11px] font-bold leading-tight text-[var(--text-primary)]">کیف پول</span>
                                    <span className="block truncate text-[10px] font-bold tabular-nums leading-tight text-[var(--text-muted)]">
                                        {walletShown.toLocaleString('fa-IR')}
                                    </span>
                                </span>
                            </span>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={payWithWallet}
                                aria-label="پرداخت با کیف پول"
                                onClick={() => setPayWithWallet((value) => !value)}
                                className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full border-0 p-0 transition-colors ${payWithWallet ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                            >
                                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${payWithWallet ? 'left-0.5' : 'right-0.5'}`} />
                            </button>
                        </div>
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
                    </div>
                    {(couponError || paymentError || couponData) && (
                        <p className={`truncate text-[10px] font-bold ${couponError || paymentError ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {couponError || paymentError || (couponData ? `${couponData.percent.toLocaleString('fa-IR')}٪ کم شد` : '')}
                        </p>
                    )}
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
                        <p
                            className="flex items-baseline justify-end gap-1 text-[var(--text-primary)]"
                            aria-label="مبلغ قابل پرداخت"
                        >
                            <span className="text-[20px] font-black leading-none tabular-nums md:text-[26px]">
                                {(selectedPlan ? bill.finalPrice : 0).toLocaleString('fa-IR')}
                            </span>
                            <span className="text-[12px] font-bold text-[var(--text-muted)]">تومان</span>
                        </p>
                    </div>
                </div>
            }
        >
            <div dir="rtl">
                {plansError && <p className="mb-3 text-center text-[12px] font-bold text-rose-600">{plansError}</p>}
                {isLoadingPlans ? (
                    <div className="flex min-h-[280px] items-center justify-center">
                        <Loader2 className="animate-spin text-[var(--accent)]" />
                    </div>
                ) : visiblePlans.length === 0 ? (
                    <p className="py-16 text-center text-[13px] text-[var(--text-muted)]">الان پلنی برای خرید باز نیست.</p>
                ) : (
                    <div className={gridClass}>
                        {visiblePlans.map((plan) => {
                            const selected = plan.id === selectedPlan?.id;
                            const tint = planTint(plan.id, plan.name, plan.iconColors?.primary);
                            const shimmer = planShimmerClass(plan.id, plan.name);
                            const daily = equivalentPerDay(plan.price, plan.days);
                            const compare = plan.comparePrice && plan.comparePrice > plan.price ? plan.comparePrice : null;
                            const offPercent = compare ? Math.round((1 - plan.price / compare) * 100) : 0;
                            const lines = planBenefitLines(plan).filter((line) => !line.includes('کمتر از قیمت اصلی'));
                            return (
                                <button
                                    key={plan.id}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => setSelectedPlanId(plan.id)}
                                    className="relative flex h-full min-h-[300px] cursor-pointer flex-col items-center rounded-3xl border bg-transparent px-3.5 py-5 text-center transition-shadow md:min-h-[440px] md:px-4 md:py-6"
                                    style={{
                                        borderColor: tint,
                                        borderWidth: selected ? 2 : 1,
                                        background: `color-mix(in srgb, ${tint} ${selected ? 16 : 5}%, transparent)`,
                                        boxShadow: selected
                                            ? `0 0 0 4px color-mix(in srgb, ${tint} 28%, transparent), 0 14px 32px color-mix(in srgb, ${tint} 20%, transparent)`
                                            : 'none',
                                    }}
                                >
                                    {plan.popular && (
                                        <span className="absolute top-3 left-3 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-white">
                                            محبوب
                                        </span>
                                    )}
                                    <PlanRibbonBadge
                                        planId={plan.id}
                                        name={plan.name}
                                        color={tint}
                                        size={78}
                                        playKey={`offer-${plan.id}`}
                                    />
                                    <h3 className={`mt-1 text-[20px] font-black leading-none md:text-[22px] ${shimmer}`}>{plan.name}</h3>
                                    <p className="mt-1 text-[11px] font-bold text-[var(--text-muted)]">{durationTabLabel(plan.days, plan.unlimited)}</p>
                                    <p className="mt-3 flex items-baseline justify-center gap-1 text-[var(--text-primary)]">
                                        <span className="text-[22px] font-black leading-none tabular-nums md:text-[26px]">
                                            {plan.price.toLocaleString('fa-IR')}
                                        </span>
                                        <span className="text-[11px] font-bold text-[var(--text-muted)]">تومان</span>
                                    </p>
                                    {(compare || plan.loyaltyPercent) ? (
                                        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                                            {compare && (
                                                <span className="text-[11px] font-bold tabular-nums text-[var(--text-muted)] line-through">
                                                    {compare.toLocaleString('fa-IR')}
                                                </span>
                                            )}
                                            {offPercent > 0 && (
                                                <span
                                                    className="rounded-full px-1.5 py-0.5 text-[10px] font-black"
                                                    style={{ color: tint, background: `color-mix(in srgb, ${tint} 16%, transparent)` }}
                                                >
                                                    {offPercent.toLocaleString('fa-IR')}٪
                                                </span>
                                            )}
                                            {!!plan.loyaltyPercent && (
                                                <span
                                                    className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                                                    style={{ color: tint, background: `color-mix(in srgb, ${tint} 16%, transparent)` }}
                                                >
                                                    وفاداری {plan.loyaltyPercent.toLocaleString('fa-IR')}٪
                                                </span>
                                            )}
                                        </div>
                                    ) : null}
                                    {daily != null && (
                                        <span
                                            className="mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold"
                                            style={{
                                                color: tint,
                                                borderColor: `color-mix(in srgb, ${tint} 35%, transparent)`,
                                                background: `color-mix(in srgb, ${tint} 8%, transparent)`,
                                            }}
                                        >
                                            <span>معادل</span>
                                            <span className="tabular-nums">{daily.toLocaleString('fa-IR')}</span>
                                            <span className="font-medium opacity-75">در روز</span>
                                        </span>
                                    )}
                                    <ul className="mt-4 w-full space-y-1.5 text-right">
                                        {lines.map((line) => (
                                            <li key={line} className="flex items-start gap-1.5 text-[11px] leading-5 text-[var(--text-secondary)]">
                                                <Check size={12} className="mt-0.5 shrink-0" style={{ color: tint }} />
                                                <span>{line}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </ResponsiveModal>
    );
}
