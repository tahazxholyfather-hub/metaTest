import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { flowApi } from '../lib/authApi';
import { useUser } from '../context/UserContext';
import { ResponsiveModal } from './ResponsiveModal';
import { PlanLordIcon, durationTabLabel, planBenefitLines, pricePerDay, type ShopPlan } from './plan/PlanMarks';

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
    const daily = selectedPlan ? pricePerDay(bill.finalPrice, selectedPlan.days) : null;
    const benefits = selectedPlan ? planBenefitLines(selectedPlan) : [];

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

    const discountBadge = bill.crossed ? Math.round(((bill.crossed - bill.pay) / bill.crossed) * 100) : 0;

    return (
        <ResponsiveModal
            isOpen={isOpen}
            onClose={handleClose}
            title="انتخاب اشتراک"
            maxWidthClass="md:w-[min(860px,96vw)] md:max-w-[96vw]"
            footer={
                <div className="space-y-3" dir="rtl">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-app)] px-2 py-1.5">
                            <input
                                type="text"
                                value={discountCode}
                                onChange={(event) => {
                                    setDiscountCode(event.target.value);
                                    setCouponError('');
                                    if (couponData && event.target.value.trim() !== couponData.code) setCouponData(null);
                                }}
                                placeholder="کد تخفیف"
                                disabled={!selectedPlan || isApplyingDiscount}
                                className="min-w-0 flex-1 bg-transparent px-1 py-1 text-[12px] outline-none"
                            />
                            <button
                                type="button"
                                onClick={handleApplyDiscount}
                                disabled={!discountCode.trim() || isApplyingDiscount || !selectedPlan}
                                className="h-8 shrink-0 rounded-lg bg-[var(--accent)] px-3 text-[11px] font-bold text-white disabled:opacity-40"
                            >
                                {isApplyingDiscount ? <Loader2 size={14} className="animate-spin" /> : 'اعمال'}
                            </button>
                        </div>
                        <p className={`text-[11px] font-bold sm:max-w-[220px] ${couponError ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {couponError || (couponData ? `${couponData.percent.toLocaleString('fa-IR')}٪ از مبلغ این پلن کم شد` : '')}
                        </p>
                    </div>

                    {selectedPlan && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)]">
                            {bill.crossed && <span className="line-through">{bill.crossed.toLocaleString('fa-IR')}</span>}
                            <span>قیمت پلن {bill.pay.toLocaleString('fa-IR')}</span>
                            {bill.loyaltyOff > 0 && <span>تمدید −{bill.loyaltyOff.toLocaleString('fa-IR')}</span>}
                            {bill.couponOff > 0 && <span>کد −{bill.couponOff.toLocaleString('fa-IR')}</span>}
                            <span className="font-black text-[var(--text-primary)]">قابل پرداخت {bill.finalPrice.toLocaleString('fa-IR')} تومان</span>
                        </div>
                    )}
                    {paymentError && <p className="text-[11px] font-bold text-rose-600">{paymentError}</p>}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                role="switch"
                                aria-checked={payWithWallet}
                                onClick={() => setPayWithWallet((value) => !value)}
                                className={`relative h-6 w-11 rounded-full transition-colors ${payWithWallet ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                            >
                                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${payWithWallet ? 'left-0.5' : 'right-0.5'}`} />
                            </button>
                            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--text-primary)]">
                                <Wallet size={14} className="text-[var(--accent)]" />
                                کیف پول
                                <span className="font-medium text-[var(--text-muted)]">
                                    {(walletBalance ?? user?.toman_balance ?? 0).toLocaleString('fa-IR')} تومان
                                </span>
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handlePay}
                            disabled={isPaying || !selectedPlan || isLoadingPlans}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-[13px] font-bold text-white disabled:opacity-40"
                        >
                            {isPaying ? <Loader2 size={16} className="animate-spin" /> : null}
                            پرداخت
                        </button>
                    </div>
                </div>
            }
        >
            <div dir="rtl">
                <style>{`
                    @keyframes textShimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
                    .shimmer-bronze, .shimmer-silver, .shimmer-golden, .shimmer-diamond {
                        background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                        animation: textShimmer 4s linear infinite;
                    }
                    .shimmer-bronze { background-image: linear-gradient(90deg, #854d0e 0%, #d97706 40%, #fde68a 50%, #d97706 60%, #854d0e 100%); }
                    .shimmer-silver { background-image: linear-gradient(90deg, #334155 0%, #94a3b8 40%, #f8fafc 50%, #94a3b8 60%, #334155 100%); }
                    .shimmer-golden { background-image: linear-gradient(90deg, #b45309 0%, #fbbf24 40%, #fff7d6 50%, #fbbf24 60%, #b45309 100%); }
                    .shimmer-diamond { background-image: linear-gradient(90deg, #1d4ed8 0%, #38bdf8 40%, #e0f2fe 50%, #38bdf8 60%, #1d4ed8 100%); }
                    @media (prefers-reduced-motion: reduce) {
                        .shimmer-bronze, .shimmer-silver, .shimmer-golden, .shimmer-diamond { animation: none; }
                    }
                `}</style>

                {plansError && <p className="mb-3 text-center text-[12px] font-bold text-rose-600">{plansError}</p>}
                {isLoadingPlans ? (
                    <div className="flex min-h-[240px] items-center justify-center">
                        <Loader2 className="animate-spin text-[var(--accent)]" />
                    </div>
                ) : visiblePlans.length === 0 ? (
                    <p className="py-16 text-center text-[13px] text-[var(--text-muted)]">الان پلنی برای خرید باز نیست.</p>
                ) : (
                    <>
                        <div className="mb-5 flex w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-element)] p-1">
                            {visiblePlans.map((plan) => {
                                const active = plan.id === selectedPlan?.id;
                                return (
                                    <button
                                        key={plan.id}
                                        type="button"
                                        onClick={() => setSelectedPlanId(plan.id)}
                                        className={`relative flex-1 rounded-xl px-2 py-2 text-[12px] font-bold ${active ? 'text-white' : 'text-[var(--text-muted)]'}`}
                                    >
                                        {active && (
                                            <motion.span layoutId="planDurationTab" className="absolute inset-0 rounded-xl bg-[var(--accent)]" transition={{ duration: 0.22 }} />
                                        )}
                                        <span className="relative z-10">{durationTabLabel(plan.days, plan.unlimited)}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <AnimatePresence mode="wait">
                            {selectedPlan && (
                                <motion.div
                                    key={selectedPlan.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.22 }}
                                    className="grid grid-cols-2 items-start gap-3 sm:gap-6"
                                >
                                    <div className="text-right">
                                        <h3 className={`text-2xl font-black leading-none sm:text-4xl ${selectedPlan.shimmerClass}`}>{selectedPlan.name}</h3>
                                        <p className="mt-3 text-[13px] font-bold text-[var(--text-secondary)]">
                                            {selectedPlan.unlimited || selectedPlan.days == null
                                                ? 'بدون تاریخ پایان'
                                                : `${selectedPlan.days.toLocaleString('fa-IR')} روز`}
                                            {daily != null && (
                                                <span className="mr-2 font-medium text-[var(--text-muted)]">
                                                    روزانه {daily.toLocaleString('fa-IR')} تومان
                                                </span>
                                            )}
                                        </p>
                                        <ul className="mt-5 space-y-2">
                                            {benefits.map((line) => (
                                                <li key={line} className="flex items-start gap-2 text-[13px] leading-6 text-[var(--text-primary)]">
                                                    <Check size={15} className="mt-1 shrink-0 text-emerald-500" />
                                                    <span>{line}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <PlanLordIcon
                                            iconKey={selectedPlan.iconKey}
                                            planId={selectedPlan.id}
                                            name={selectedPlan.name}
                                            color={selectedPlan.iconColors?.primary}
                                            size={112}
                                            playKey={selectedPlan.id}
                                        />
                                        <div className="mt-2 text-center">
                                            {bill.crossed && (
                                                <div className="mb-1 flex items-center justify-center gap-2">
                                                    <span className="text-[12px] text-[var(--text-muted)] line-through">{bill.crossed.toLocaleString('fa-IR')}</span>
                                                    {discountBadge > 0 && (
                                                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-600">
                                                            {discountBadge.toLocaleString('fa-IR')}٪
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <p className="text-4xl font-black tabular-nums leading-none text-[var(--text-primary)]">
                                                {bill.finalPrice.toLocaleString('fa-IR')}
                                            </p>
                                            <p className="mt-1 text-[12px] font-bold text-[var(--text-muted)]">تومان</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}
            </div>
        </ResponsiveModal>
    );
}
