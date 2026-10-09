import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Tag, Loader2, Check } from 'lucide-react';
import { Player } from '@lordicon/react';
import { toast } from 'sonner';
import ICON_DATA from '../assets/wired-gradient-3235-badge-ribbon-in-reveal.json';
import { flowApi } from '../lib/authApi';
import { useUser } from '../context/UserContext';
import { ResponsiveModal } from './ResponsiveModal';

type Plan = {
    id: string;
    name: string;
    days: number | null;
    unlimited?: boolean;
    purchasable?: boolean;
    loyaltyPercent?: number;
    price: number;
    iconColors: {
        primary: string;
        secondary: string;
    };
    shimmerClass: string;
    activeShadow: string;
    activeBorder: string;
    popular?: boolean;
    planDiscountPercent?: number;
};

type ShopMeta = {
    queueEnabled?: boolean;
    loyaltyOpen?: boolean;
    loyaltyFromPlanName?: string | null;
    loyaltyHoursLeft?: number | null;
};

type CouponState = {
    code: string;
    percent: number;
    couponId?: string;
    message?: string;
};

interface PlanSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onActivated?: () => void;
}

function durationLabel(plan: Plan) {
    if (plan.unlimited || plan.days === null) return 'نامحدود';
    return `دوره ${plan.days} روزه`;
}

const LordIcon = ({
                      colors,
                      size = 72,
                  }: {
    colors?: { primary: string; secondary: string };
    size?: number;
}) => {
    const playerRef = useRef<Player>(null);

    useEffect(() => {
        const timeout = setTimeout(() => {
            playerRef.current?.playFromBeginning();
        }, 300);

        return () => clearTimeout(timeout);
    }, []);

    return (
        <div className="flex items-center justify-center">
            <Player
                ref={playerRef}
                icon={ICON_DATA}
                size={size}
                colorize={colors?.primary}
                trigger="hover"
            />
        </div>
    );
};

function mapBackendPlan(plan: any): Plan {
    const name = plan.name || '';
    let shimmerClass = 'shimmer-silver';
    let activeShadow = 'shadow-[0_0_25px_rgba(148,163,184,0.15)]';
    let activeBorder = 'border-slate-400/60';
    let iconColors = { primary: '#94a3b8', secondary: '#475569' };

    if (name.includes('برنز')) {
        shimmerClass = 'shimmer-bronze';
        activeShadow = 'shadow-[0_0_25px_rgba(205,127,50,0.15)]';
        activeBorder = 'border-[#cd7f32]/60';
        iconColors = { primary: '#cd7f32', secondary: '#a0522d' };
    } else if (name.includes('طلا')) {
        shimmerClass = 'shimmer-golden';
        activeShadow = 'shadow-[0_0_25px_rgba(251,191,36,0.15)]';
        activeBorder = 'border-amber-500/60';
        iconColors = { primary: '#fbbf24', secondary: '#b45309' };
    } else if (name.includes('الماس') || name.includes('دیاموند')) {
        shimmerClass = 'shimmer-diamond';
        activeShadow = 'shadow-[0_0_25px_rgba(56,189,248,0.15)]';
        activeBorder = 'border-sky-500/60';
        iconColors = { primary: '#38bdf8', secondary: '#1d4ed8' };
    }

    return {
        id: String(plan.id),
        name: plan.name,
        days: plan.unlimited === true || plan.days === null ? null : Number(plan.days || 30),
        unlimited: plan.unlimited === true || plan.days === null,
        purchasable: plan.purchasable !== false,
        loyaltyPercent: Number(plan.loyaltyPercent || 0),
        price: Number(plan.price || 0),
        planDiscountPercent: Number(plan.planDiscountPercent || plan.discountPercent || 0),
        popular: Boolean(plan.popular || plan.isPopular),
        iconColors: plan.iconColors || iconColors,
        shimmerClass: plan.shimmerClass || shimmerClass,
        activeShadow: plan.activeShadow || activeShadow,
        activeBorder: plan.activeBorder || activeBorder,
    };
}

function getPricingDetails(plan: Plan | undefined, coupon: CouponState | null) {
    if (!plan) {
        return {
            basePrice: 0,
            planDiscountPercent: 0,
            planDiscountAmount: 0,
            priceAfterPlanDiscount: 0,
            couponUsed: false,
            couponCode: null as string | null,
            loyaltyPercent: 0,
            loyaltyDiscountAmount: 0,
            couponPercent: 0,
            couponDiscountAmount: 0,
            finalPrice: 0,
            hasAnyDiscount: false,
        };
    }

    const basePrice = plan.price;
    const planDiscountPercent = plan.planDiscountPercent ?? 0;
    const planDiscountAmount = Math.round((basePrice * planDiscountPercent) / 100);
    const priceAfterPlanDiscount = basePrice - planDiscountAmount;
    const loyaltyPercent = plan.loyaltyPercent ?? 0;
    const loyaltyDiscountAmount = Math.round((priceAfterPlanDiscount * loyaltyPercent) / 100);
    const priceAfterLoyalty = priceAfterPlanDiscount - loyaltyDiscountAmount;

    const couponUsed = !!coupon;
    const couponPercent = coupon?.percent ?? 0;
    const couponDiscountAmount = Math.round((priceAfterLoyalty * couponPercent) / 100);
    const finalPrice = priceAfterLoyalty - couponDiscountAmount;

    return {
        basePrice,
        planDiscountPercent,
        planDiscountAmount,
        priceAfterPlanDiscount,
        loyaltyPercent,
        loyaltyDiscountAmount,
        couponUsed,
        couponCode: coupon?.code ?? null,
        couponPercent,
        couponDiscountAmount,
        finalPrice,
        hasAnyDiscount: planDiscountPercent > 0 || loyaltyPercent > 0 || couponUsed,
    };
}

export default function PlanSelectionModal({
                                               isOpen,
                                               onClose,
                                               onActivated,
                                           }: PlanSelectionModalProps) {
    const { user, setUser } = useUser();

    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);
    const [plansError, setPlansError] = useState('');
    const [shopMeta, setShopMeta] = useState<ShopMeta | null>(null);

    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [discountCode, setDiscountCode] = useState('');
    const [couponData, setCouponData] = useState<CouponState | null>(null);
    const [couponError, setCouponError] = useState('');
    const [paymentError, setPaymentError] = useState('');
    const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    const [payWithWallet, setPayWithWallet] = useState(false);

    const selectedPlan = useMemo(
        () => plans.find((plan) => plan.id === selectedPlanId),
        [plans, selectedPlanId]
    );

    const pricingDetails = useMemo(
        () => getPricingDetails(selectedPlan, couponData),
        [selectedPlan, couponData]
    );

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const fetchPlans = async () => {
            try {
                setIsLoadingPlans(true);
                setPlansError('');
                const res = await flowApi.subscriptionPlans();

                if (!isMounted) return;

                if (res.success && Array.isArray(res.data)) {
                    const formattedPlans = res.data.map(mapBackendPlan);
                    setPlans(formattedPlans);
                    setShopMeta((res as any).meta || null);

                    const defaultPlan = formattedPlans.find((p) => p.purchasable !== false && p.popular)
                        || formattedPlans.find((p) => p.purchasable !== false);
                    setSelectedPlanId(defaultPlan ? defaultPlan.id : null);
                } else {
                    const errMsg = res.message || 'خطا در دریافت لیست پلن‌ها از سرور.';
                    setPlansError(errMsg);
                    toast.error(errMsg);
                }
            } catch (err) {
                if (isMounted) {
                    setPlansError('خطا در دریافت پلن‌های اشتراک.');
                    toast.error('دریافت لیست پلن‌ها با خطا مواجه شد.');
                }
            } finally {
                if (isMounted) {
                    setIsLoadingPlans(false);
                }
            }
        };

        fetchPlans();

        return () => {
            isMounted = false;
        };
    }, [isOpen]);

    useEffect(() => {
        setCouponData(null);
        setCouponError('');
    }, [selectedPlanId]);

    const resetState = () => {
        setPlans([]);
        setSelectedPlanId(null);
        setDiscountCode('');
        setCouponData(null);
        setCouponError('');
        setPaymentError('');
        setIsApplyingDiscount(false);
        setIsPaying(false);
        setPayWithWallet(false);
        setPlansError('');
        setShopMeta(null);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleDiscountCodeChange = (value: string) => {
        setDiscountCode(value);
        setCouponError('');
        setPaymentError('');

        if (couponData && value.trim() !== couponData.code) {
            setCouponData(null);
        }
    };

    const handleApplyDiscount = async () => {
        const code = discountCode.trim();

        if (!code || !selectedPlan || isApplyingDiscount) {
            return;
        }

        try {
            setIsApplyingDiscount(true);
            setCouponError('');
            setPaymentError('');
            setCouponData(null);

            const res = await flowApi.validateSubscriptionDiscount({
                code,
                planId: selectedPlan.id,
            });

            if (!res?.success) {
                const errMsg = res?.message || 'کد تخفیف معتبر نیست.';
                setCouponError(errMsg);
                toast.error(errMsg);
                return;
            }

            const data = res.data || {};
            const coupon = data.coupon || data;
            const percent = Number(
                coupon.percent ?? data.discountPercent ?? data.pricing?.couponPercent ?? 0
            );

            if (!percent || percent <= 0) {
                const errMsg = data.message || res.message || 'کد تخفیف معتبر نیست.';
                setCouponError(errMsg);
                toast.error(errMsg);
                return;
            }

            setCouponData({
                code: coupon.code || code,
                percent,
                couponId: String(coupon.id ?? data.couponId ?? data.id ?? ''),
                message: data.message ?? res.message,
            });
            toast.success(`تخفیف ${percent}٪ با موفقیت اعمال شد.`);
        } catch (error) {
            setCouponError('خطا در بررسی کد تخفیف. لطفا دوباره تلاش کنید.');
            toast.error('خطا در برقراری ارتباط با سرور.');
        } finally {
            setIsApplyingDiscount(false);
        }
    };

    const handlePay = async () => {
        if (!selectedPlan || selectedPlan.purchasable === false || isPaying) {
            return;
        }

        const toastId = toast.loading('در حال ایجاد درخواست پرداخت...');

        try {
            setIsPaying(true);
            setPaymentError('');

            // گرفتن نام کامل از دیتای جدید
            const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");

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
                const errMsg = res?.message || 'خطا در ایجاد پرداخت.';
                setPaymentError(errMsg);
                toast.error(errMsg, { id: toastId });
                return;
            }

            if (res.data?.directActivated) {
                toast.success(res.message || (res.data?.queued ? 'پلن در صف رزرو ثبت شد.' : 'اشتراک شما با موفقیت فعال شد.'), { id: toastId });
                try {
                    const info = await flowApi.getUserInfo();
                    if (info?.success && info.data) setUser(info.data);
                } catch {
                    // The purchase already landed; the next page load refreshes the plan chip.
                }
                onActivated?.();
                handleClose();
                return;
            }

            const paymentUrl =
                res?.data?.paymentUrl ||
                res?.data?.url ||
                res?.data?.redirectUrl ||
                res?.data?.gatewayUrl;

            if (paymentUrl) {
                toast.success('در حال انتقال به درگاه پرداخت...', { id: toastId });
                window.location.href = paymentUrl;
                return;
            }

            setPaymentError('لینک پرداخت از سرور دریافت نشد.');
            toast.error('لینک پرداخت از سرور دریافت نشد.', { id: toastId });
        } catch (error) {
            console.error("Payment API Error:", error);
            setPaymentError('خطا در اتصال به درگاه پرداخت. لطفا دوباره تلاش کنید.');
            toast.error('خطا در برقراری ارتباط با درگاه پرداخت.', { id: toastId });
        } finally {
            setIsPaying(false);
        }
    };

    const getCardPrice = (plan: Plan) => {
        const details = getPricingDetails(plan, couponData);

        return {
            originalPrice: details.basePrice,
            discountedPrice: details.finalPrice,
            hasDiscount: details.hasAnyDiscount,
            hasPlanDiscount: details.planDiscountPercent > 0,
            hasCouponDiscount: details.couponUsed,
        };
    };

    return (
        <ResponsiveModal
            isOpen={isOpen}
            onClose={handleClose}
            title="اشتراک ویژه"
            maxWidthClass="md:w-[min(1080px,96vw)] md:max-w-[96vw]"
            footer={
                <div className="space-y-3">
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)]/40 bg-[var(--bg-elevated)]/40 px-4 py-3 cursor-pointer">
                        <span className="text-xs font-bold text-[var(--text-primary)]">پرداخت با کیف پول تومانی</span>
                        <input
                            type="checkbox"
                            checked={payWithWallet}
                            onChange={(e) => setPayWithWallet(e.target.checked)}
                            className="h-4 w-4 accent-[var(--accent)]"
                        />
                    </label>
                    <button
                        onClick={handlePay}
                        disabled={isPaying || !selectedPlan || selectedPlan.purchasable === false || isLoadingPlans}
                        className="flex w-full items-center justify-center gap-3 rounded-xl bg-[var(--accent)] py-4 text-sm font-black text-white shadow-[0_10px_24px_-12px_color-mix(in_srgb,var(--accent)_70%,transparent)] disabled:opacity-60"
                    >
                        {isPaying ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                در حال اتصال...
                            </>
                        ) : (
                            <>
                                <Check size={18} />
                                تایید و پرداخت نهایی
                            </>
                        )}
                    </button>
                </div>
            }
        >
            <div dir="rtl">
                    <style>{`
                        @keyframes textShimmer {
                            0% { background-position: 100% 0; }
                            100% { background-position: -100% 0; }
                        }
                        .shimmer-bronze {
                            background: linear-gradient(90deg, #854d0e 0%, #d97706 25%, #fde68a 50%, #d97706 75%, #854d0e 100%);
                            background-size: 200% auto;
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            animation: textShimmer 4s linear infinite;
                        }
                        .shimmer-silver {
                            background: linear-gradient(90deg, #475569 0%, #94a3b8 25%, #f8fafc 50%, #94a3b8 75%, #475569 100%);
                            background-size: 200% auto;
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            animation: textShimmer 4s linear infinite;
                        }
                        .shimmer-golden {
                            background: linear-gradient(90deg, #b45309 0%, #fbbf24 25%, #fff9db 50%, #fbbf24 75%, #b45309 100%);
                            background-size: 200% auto;
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            animation: textShimmer 4s linear infinite;
                        }
                        .shimmer-diamond {
                            background: linear-gradient(90deg, #1d4ed8 0%, #38bdf8 25%, #f0f9ff 50%, #38bdf8 75%, #1d4ed8 100%);
                            background-size: 200% auto;
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            animation: textShimmer 4s linear infinite;
                        }
                        .scrollbar-hide::-webkit-scrollbar { display: none; }
                        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
                    `}</style>
                    <p className="mb-4 text-xs text-[var(--text-muted)]">
                        دسترسی کامل را انتخاب کنید
                    </p>
                    {shopMeta?.queueEnabled && (Number(user?.days_remaining) > 0 || user?.plan_unlimited) && (
                        <div className="mb-4 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-[11px] leading-6 text-sky-700 dark:text-sky-300">
                            اشتراک فعلی‌ات هنوز تمام نشده. پلن تازه‌ای که بخری در صف رزرو می‌ماند و به محض پایان این اشتراک فعال می‌شود.
                        </div>
                    )}
                    {shopMeta && shopMeta.queueEnabled === false && (Number(user?.days_remaining) > 0 || user?.plan_unlimited) && (
                        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[11px] leading-6 text-amber-700 dark:text-amber-300">
                            خرید جدید از همین لحظه جایگزین اشتراک فعلی می‌شود.
                        </div>
                    )}
                    {shopMeta?.loyaltyOpen && (
                        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[11px] leading-6 text-emerald-700 dark:text-emerald-300">
                            تا {shopMeta.loyaltyHoursLeft ?? ''} ساعت دیگر، به‌خاطر پایان {shopMeta.loyaltyFromPlanName || 'اشتراک قبلی'} تخفیف تمدید روی پلن‌های مشخص‌شده اعمال می‌شود.
                        </div>
                    )}
                    <div className="space-y-3">
                            {plansError && (
                                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm text-rose-400">
                                    {plansError}
                                </div>
                            )}

                            {isLoadingPlans ? (
                                <div className="flex min-h-[220px] flex-col items-center justify-center gap-3">
                                    <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
                                    <span className="text-xs text-[var(--text-muted)]">در حال بارگذاری پلن‌های اشتراک...</span>
                                </div>
                            ) : (
                                <>
                                    {/* Desktop View */}
                                    <div className="hidden gap-4 sm:grid sm:grid-cols-4">
                                        {plans.map((plan) => {
                                            const locked = plan.purchasable === false;
                                            const isSelected = !locked && selectedPlanId === plan.id;
                                            const {
                                                originalPrice,
                                                discountedPrice,
                                                hasDiscount,
                                                hasCouponDiscount,
                                            } = getCardPrice(plan);

                                            return (
                                                <motion.button
                                                    key={plan.id}
                                                    type="button"
                                                    disabled={locked}
                                                    onClick={() => {
                                                        if (!locked) setSelectedPlanId(plan.id);
                                                    }}
                                                    whileHover={locked ? undefined : { y: -4 }}
                                                    className={`relative flex h-48 flex-col items-center rounded-2xl border p-5 transition-all duration-300 ${
                                                        locked
                                                            ? 'cursor-not-allowed border-slate-500/40 bg-slate-500/10 grayscale'
                                                            : isSelected
                                                            ? `${plan.activeShadow} ${plan.activeBorder} bg-[var(--bg-elevated)]`
                                                            : 'border-[var(--border)]/50 bg-[var(--bg-elevated)]/20 hover:bg-[var(--bg-elevated)]/40'
                                                    }`}
                                                >
                                                    {locked && (
                                                        <span className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-950/55">
                                                            <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-black text-slate-700 shadow-lg">
                                                                غیرقابل خرید
                                                            </span>
                                                        </span>
                                                    )}
                                                    {plan.popular && (
                                                        <span className="absolute -top-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-0.5 text-[10px] font-black text-white shadow-lg">
                                                            محبوب‌ترین
                                                        </span>
                                                    )}

                                                    <div className="mb-4">
                                                        <LordIcon colors={plan.iconColors} size={64} />
                                                    </div>

                                                    <h3 className={`mb-1 text-sm font-black ${plan.shimmerClass}`}>
                                                        {plan.name}
                                                    </h3>

                                                    <p className="mb-auto text-[10px] text-[var(--text-muted)]">
                                                        {durationLabel(plan)}
                                                    </p>

                                                    <div className="mt-4">
                                                        {hasDiscount ? (
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[10px] text-[var(--text-muted)] line-through">
                                                                    {originalPrice.toLocaleString('fa-IR')}
                                                                </span>
                                                                <span className="text-sm font-black text-emerald-500">
                                                                    {discountedPrice.toLocaleString('fa-IR')}
                                                                    <small className="text-[9px] font-normal"> تومان</small>
                                                                </span>
                                                                <div className="mt-1 flex flex-col items-center gap-0.5">
                                                                    {hasCouponDiscount && (
                                                                        <span className="text-[9px] text-emerald-500">
                                                                            کد تخفیف
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm font-black">
                                                                {originalPrice.toLocaleString('fa-IR')}
                                                                <small className="text-[9px] font-normal text-[var(--text-muted)]">
                                                                    {' '}
                                                                    تومان
                                                                </small>
                                                            </span>
                                                        )}
                                                    </div>
                                                </motion.button>
                                            );
                                        })}
                                    </div>

                                    {/* Mobile View */}
                                    <div className="flex flex-col gap-3 sm:hidden">
                                        {plans.map((plan) => {
                                            const locked = plan.purchasable === false;
                                            const isSelected = !locked && selectedPlanId === plan.id;
                                            const {
                                                originalPrice,
                                                discountedPrice,
                                                hasDiscount,
                                            } = getCardPrice(plan);

                                            return (
                                                <button
                                                    key={plan.id}
                                                    type="button"
                                                    disabled={locked}
                                                    onClick={() => {
                                                        if (!locked) setSelectedPlanId(plan.id);
                                                    }}
                                                    className={`relative flex items-center justify-between overflow-hidden rounded-xl border p-4 transition-all ${
                                                        locked
                                                            ? 'cursor-not-allowed border-slate-500/40 bg-slate-500/15 grayscale'
                                                            : isSelected
                                                            ? `${plan.activeBorder} bg-[var(--bg-elevated)] shadow-lg`
                                                            : 'border-[var(--border)]/40 bg-[var(--bg-elevated)]/20'
                                                    }`}
                                                >
                                                    {locked && (
                                                        <span className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/50 text-[10px] font-black text-slate-100">
                                                            غیرقابل خرید
                                                        </span>
                                                    )}
                                                    <div className="flex items-center gap-3">
                                                        <LordIcon colors={plan.iconColors} size={40} />
                                                        <div className="text-right">
                                                            <h3 className={`text-sm font-bold ${plan.shimmerClass}`}>
                                                                {plan.name}
                                                            </h3>
                                                            <p className="text-[10px] text-[var(--text-muted)]">
                                                                {durationLabel(plan)}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col items-end text-left">
                                                        {hasDiscount ? (
                                                            <>
                                                                <span className="text-[10px] text-[var(--text-muted)] line-through">
                                                                    {originalPrice.toLocaleString('fa-IR')}
                                                                </span>
                                                                <span className="text-sm font-black text-emerald-500">
                                                                    {discountedPrice.toLocaleString('fa-IR')}
                                                                </span>
                                                                <span className="text-[9px] text-[var(--text-muted)]">
                                                                    تومان
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="text-sm font-black">
                                                                    {originalPrice.toLocaleString('fa-IR')}
                                                                </span>
                                                                <span className="text-[9px] text-[var(--text-muted)]">
                                                                    تومان
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            <div className="grid grid-cols-1 gap-6 pt-4 md:grid-cols-2">
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
                                        <Tag size={14} className="text-[var(--accent)]" />
                                        کد تخفیف
                                    </label>

                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={discountCode}
                                            onChange={(e) => handleDiscountCodeChange(e.target.value)}
                                            placeholder="کد خود را اینجا وارد کنید..."
                                            disabled={!selectedPlan || isApplyingDiscount}
                                            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-[var(--accent)]/20 disabled:opacity-50"
                                        />

                                        <button
                                            onClick={handleApplyDiscount}
                                            disabled={!discountCode.trim() || isApplyingDiscount || !selectedPlan}
                                            className="absolute bottom-1.5 left-1.5 top-1.5 px-4 text-[10px] font-bold text-white rounded-lg bg-[var(--accent)] disabled:opacity-50"
                                        >
                                            {isApplyingDiscount ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : couponData && couponData.code === discountCode.trim() ? (
                                                'اعمال شد'
                                            ) : (
                                                'تایید کد'
                                            )}
                                        </button>
                                    </div>

                                    {couponError ? (
                                        <p className="text-xs font-medium text-rose-500">{couponError}</p>
                                    ) : null}

                                    {couponData ? (
                                        <p className="text-xs font-medium text-emerald-500">
                                            {couponData.message || `کد تخفیف با موفقیت اعمال شد (${couponData.percent}٪)`}
                                        </p>
                                    ) : null}

                                    {paymentError ? (
                                        <p className="text-xs font-medium text-rose-500">{paymentError}</p>
                                    ) : null}
                                </div>

                                {selectedPlan ? (
                                    <div className="space-y-3 rounded-2xl border border-[var(--border)]/40 bg-[var(--bg-elevated)]/40 p-5">
                                        <div className="flex justify-between text-xs text-[var(--text-muted)]">
                                            <span>قیمت پایه:</span>
                                            <span>{pricingDetails.basePrice.toLocaleString('fa-IR')} تومان</span>
                                        </div>

                                        {pricingDetails.planDiscountPercent > 0 ? (
                                            <div className="flex justify-between text-xs font-bold text-amber-500">
                                                <span>
                                                    تخفیف پلن ({pricingDetails.planDiscountPercent}٪):
                                                </span>
                                                <span>
                                                    -
                                                    {pricingDetails.planDiscountAmount.toLocaleString(
                                                        'fa-IR'
                                                    )}{' '}
                                                    تومان
                                                </span>
                                            </div>
                                        ) : null}

                                        {pricingDetails.couponUsed ? (
                                            <div className="flex justify-between text-xs font-bold text-emerald-500">
                                                <span>
                                                    کد تخفیف ({pricingDetails.couponPercent}٪):
                                                </span>
                                                <span>
                                                    -
                                                    {pricingDetails.couponDiscountAmount.toLocaleString(
                                                        'fa-IR'
                                                    )}{' '}
                                                    تومان
                                                </span>
                                            </div>
                                        ) : null}

                                        <div className="flex items-center justify-between border-t border-[var(--border)]/40 pt-3">
                                            <span className="text-sm font-bold">مبلغ نهایی:</span>
                                            <span className="text-xl font-black text-[var(--accent)]">
                                                {pricingDetails.finalPrice.toLocaleString('fa-IR')}
                                                <small className="text-xs font-normal text-[var(--text-muted)]">
                                                    {' '}
                                                    تومان
                                                </small>
                                            </span>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>

            </div>
        </ResponsiveModal>
    );
}
