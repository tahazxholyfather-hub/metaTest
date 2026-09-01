import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Check, Zap, Shield, Crown, Gem, ChevronLeft, ChevronRight, Sparkles, TrendingUp, Star, Infinity } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanTier = 'bronze' | 'silver' | 'golden' | 'diamond';

interface PlanFeature {
    label: string;
    included: boolean;
}

interface Plan {
    id: PlanTier;
    name: string;
    nameEn: string;
    price: string;
    priceUnit: string;
    description: string;
    icon: React.ElementType;
    features: PlanFeature[];
    gradient: string;
    shimmer: string;
    glow: string;
    border: string;
    iconBg: string;
    badge?: string;
    accentColor: string;
    stats: { label: string; value: string }[];
}

// ─── Plan Data ────────────────────────────────────────────────────────────────

const PLANS: Plan[] = [
    {
        id: 'bronze',
        name: 'برنزی',
        nameEn: 'Bronze',
        price: '۴۹,۰۰۰',
        priceUnit: 'تومان / ماه',
        description: 'شروع هوشمند برای یادگیری پایه‌ای',
        icon: Shield,
        badge: undefined,
        gradient: 'from-[#cd7f32] via-[#e8a96a] to-[#a0522d]',
        shimmer: 'from-transparent via-[#e8a96a]/30 to-transparent',
        glow: 'shadow-[0_0_40px_-8px_rgba(205,127,50,0.6)]',
        border: 'border-[#cd7f32]/50',
        iconBg: 'bg-gradient-to-br from-[#cd7f32]/20 to-[#a0522d]/10',
        accentColor: '#cd7f32',
        stats: [
            { label: 'جزوات', value: '۵۰+' },
            { label: 'آزمون/ماه', value: '۱' },
        ],
        features: [
            { label: 'دسترسی به ۵۰ جزوه پایه', included: true },
            { label: 'آزمون‌های ماهانه', included: true },
            { label: 'پشتیبانی ایمیلی', included: true },
            { label: 'آموزش ویدیویی', included: false },
            { label: 'مشاور اختصاصی', included: false },
            { label: 'آزمون‌های نامحدود', included: false },
        ],
    },
    {
        id: 'silver',
        name: 'نقره‌ای',
        nameEn: 'Silver',
        price: '۸۹,۰۰۰',
        priceUnit: 'تومان / ماه',
        description: 'انتخاب محبوب برای دانش‌آموزان جدی',
        icon: Zap,
        badge: 'محبوب',
        gradient: 'from-[#9ca3af] via-[#e5e7eb] to-[#6b7280]',
        shimmer: 'from-transparent via-white/40 to-transparent',
        glow: 'shadow-[0_0_40px_-8px_rgba(156,163,175,0.7)]',
        border: 'border-[#9ca3af]/60',
        iconBg: 'bg-gradient-to-br from-[#9ca3af]/20 to-[#6b7280]/10',
        accentColor: '#9ca3af',
        stats: [
            { label: 'جزوات', value: '۲۰۰+' },
            { label: 'آزمون/هفته', value: '۱' },
        ],
        features: [
            { label: 'دسترسی به ۲۰۰ جزوه', included: true },
            { label: 'آزمون‌های هفتگی', included: true },
            { label: 'پشتیبانی چت آنلاین', included: true },
            { label: 'آموزش ویدیویی', included: true },
            { label: 'مشاور اختصاصی', included: false },
            { label: 'آزمون‌های نامحدود', included: false },
        ],
    },
    {
        id: 'golden',
        name: 'طلایی',
        nameEn: 'Golden',
        price: '۱۴۹,۰۰۰',
        priceUnit: 'تومان / ماه',
        description: 'تجربه کامل برای کنکور',
        icon: Crown,
        badge: 'پیشنهادی',
        gradient: 'from-[#f59e0b] via-[#fcd34d] to-[#d97706]',
        shimmer: 'from-transparent via-[#fcd34d]/50 to-transparent',
        glow: 'shadow-[0_0_40px_-8px_rgba(245,158,11,0.8)]',
        border: 'border-[#f59e0b]/60',
        iconBg: 'bg-gradient-to-br from-[#f59e0b]/20 to-[#d97706]/10',
        accentColor: '#f59e0b',
        stats: [
            { label: 'جزوات', value: 'نامحدود' },
            { label: 'آزمون/روز', value: '۱' },
        ],
        features: [
            { label: 'دسترسی به تمام جزوات', included: true },
            { label: 'آزمون‌های روزانه', included: true },
            { label: 'پشتیبانی ۲۴ ساعته', included: true },
            { label: 'آموزش ویدیویی HD', included: true },
            { label: 'مشاور اختصاصی', included: true },
            { label: 'آزمون‌های نامحدود', included: false },
        ],
    },
    {
        id: 'diamond',
        name: 'الماسی',
        nameEn: 'Diamond',
        price: '۲۴۹,۰۰۰',
        priceUnit: 'تومان / ماه',
        description: 'تسلط کامل، بدون محدودیت',
        icon: Gem,
        badge: 'ویژه',
        gradient: 'from-[#60a5fa] via-[#e0f2fe] to-[#818cf8]',
        shimmer: 'from-transparent via-white/60 to-transparent',
        glow: 'shadow-[0_0_60px_-8px_rgba(96,165,250,0.9)]',
        border: 'border-[#60a5fa]/60',
        iconBg: 'bg-gradient-to-br from-[#60a5fa]/20 to-[#818cf8]/10',
        accentColor: '#60a5fa',
        stats: [
            { label: 'جزوات', value: 'نامحدود' },
            { label: 'آزمون', value: 'نامحدود' },
        ],
        features: [
            { label: 'دسترسی به تمام جزوات', included: true },
            { label: 'آزمون‌های روزانه', included: true },
            { label: 'پشتیبانی VIP اختصاصی', included: true },
            { label: 'آموزش ویدیویی 4K', included: true },
            { label: 'مشاور اختصاصی ۲۴/۷', included: true },
            { label: 'آزمون‌های نامحدود', included: true },
        ],
    },
];

// ─── Advanced Shimmer with Multiple Layers ───────────────────────────────────

const EnhancedShimmer = ({ plan, isActive }: { plan: Plan; isActive: boolean }) => (
    <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
        {/* Primary shimmer */}
        <motion.div
            className={`absolute inset-y-0 w-1/2 bg-gradient-to-r ${plan.shimmer} skew-x-[-20deg]`}
            animate={isActive ? { x: ['-100%', '300%'] } : { x: '-100%' }}
            transition={isActive ? {
                duration: 2.4,
                repeat: Infinity,
                repeatDelay: 1.8,
                ease: 'easeInOut',
            } : {}}
        />
        {/* Secondary delayed shimmer */}
        <motion.div
            className={`absolute inset-y-0 w-1/3 bg-gradient-to-r ${plan.shimmer} skew-x-[-25deg]`}
            animate={isActive ? { x: ['-100%', '300%'] } : { x: '-100%' }}
            transition={isActive ? {
                duration: 2.4,
                repeat: Infinity,
                repeatDelay: 1.8,
                delay: 0.4,
                ease: 'easeInOut',
            } : {}}
        />
    </div>
);

// ─── Magnetic Floating Particles ──────────────────────────────────────────────

const MagneticParticles = ({ plan, isActive }: { plan: Plan; isActive: boolean }) => {
    const particles = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        size: Math.random() * 4 + 2,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 2,
        duration: Math.random() * 3 + 2,
    }));

    return (
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    className={`absolute rounded-full bg-gradient-to-br ${plan.gradient}`}
                    style={{
                        width: p.size,
                        height: p.size,
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                    }}
                    animate={isActive ? {
                        y: [0, -20, 0],
                        x: [0, Math.random() * 10 - 5, 0],
                        opacity: [0.1, 0.3, 0.1],
                        scale: [1, 1.5, 1],
                    } : { opacity: 0 }}
                    transition={{
                        duration: p.duration,
                        repeat: Infinity,
                        delay: p.delay,
                        ease: 'easeInOut',
                    }}
                />
            ))}
        </div>
    );
};

// ─── Animated Border Glow ─────────────────────────────────────────────────────

const AnimatedBorderGlow = ({ plan, isActive }: { plan: Plan; isActive: boolean }) => (
    <motion.div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        animate={isActive ? {
            boxShadow: [
                `0 0 0px 0px ${plan.accentColor}00`,
                `0 0 20px 2px ${plan.accentColor}40`,
                `0 0 0px 0px ${plan.accentColor}00`,
            ],
        } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    />
);

// ─── 3D Rotating Ring Background ──────────────────────────────────────────────

const RotatingRings = ({ plan, isActive }: { plan: Plan; isActive: boolean }) => (
    <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none opacity-10">
        {[0, 1, 2].map((i) => (
            <motion.div
                key={i}
                className={`absolute top-1/2 left-1/2 border-2 rounded-full border-current`}
                style={{
                    width: 100 + i * 60,
                    height: 100 + i * 60,
                    marginLeft: -(50 + i * 30),
                    marginTop: -(50 + i * 30),
                    color: plan.accentColor,
                }}
                animate={isActive ? {
                    rotate: 360,
                    scale: [1, 1.1, 1],
                    opacity: [0.05, 0.15, 0.05],
                } : { opacity: 0 }}
                transition={{
                    rotate: { duration: 20 + i * 5, repeat: Infinity, ease: 'linear' },
                    scale: { duration: 3 + i, repeat: Infinity, ease: 'easeInOut' },
                    opacity: { duration: 3 + i, repeat: Infinity, ease: 'easeInOut' },
                }}
            />
        ))}
    </div>
);

// ─── Liquid Morphing Background ──────────────────────────────────────────────

const LiquidMorph = ({ plan, isActive }: { plan: Plan; isActive: boolean }) => (
    <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none opacity-5">
        <motion.div
            className={`absolute w-[200%] h-[200%] bg-gradient-to-br ${plan.gradient}`}
            style={{ top: '-50%', left: '-50%' }}
            animate={isActive ? {
                rotate: [0, 360],
                scale: [1, 1.2, 1],
            } : {}}
            transition={{
                rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
                scale: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
            }}
        />
    </div>
);

// ─── Pulsing Stats ────────────────────────────────────────────────────────────

const PulsingStats = ({ stats, plan, isActive }: { stats: Plan['stats']; plan: Plan; isActive: boolean }) => (
    <div className="flex items-center gap-3 justify-center">
        {stats.map((stat, i) => (
            <motion.div
                key={i}
                className={`px-3 py-1.5 rounded-xl bg-[var(--bg-element)] border border-[var(--border)] backdrop-blur-sm`}
                initial={false}
                animate={isActive ? {
                    scale: [1, 1.05, 1],
                    borderColor: [plan.accentColor + '00', plan.accentColor + '60', plan.accentColor + '00'],
                } : {}}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.3,
                    ease: 'easeInOut',
                }}
            >
                <div className="text-[9px] text-[var(--text-muted)] font-medium mb-0.5">{stat.label}</div>
                <div className={`text-xs font-black bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent`}>
                    {stat.value}
                </div>
            </motion.div>
        ))}
    </div>
);

// ─── Enhanced Confirm Burst with Ripple ───────────────────────────────────────

const EnhancedConfirmBurst = ({ plan }: { plan: Plan }) => (
    <>
        {/* Ripple rings */}
        {[0, 1, 2].map((i) => (
            <motion.div
                key={`ring-${i}`}
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2`}
                style={{ borderColor: plan.accentColor }}
                initial={{ width: 0, height: 0, opacity: 0.6 }}
                animate={{
                    width: 200,
                    height: 200,
                    opacity: 0,
                }}
                transition={{ duration: 1, delay: i * 0.15, ease: 'easeOut' }}
            />
        ))}
        {/* Particle burst */}
        {[...Array(16)].map((_, i) => {
            const angle = (i / 16) * 360;
            const rad = (angle * Math.PI) / 180;
            return (
                <motion.div
                    key={i}
                    className={`absolute top-1/2 left-1/2 w-3 h-3 rounded-full bg-gradient-to-br ${plan.gradient}`}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{
                        x: Math.cos(rad) * 80,
                        y: Math.sin(rad) * 80,
                        opacity: 0,
                        scale: 0,
                    }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                />
            );
        })}
    </>
);

// ─── Mouse Tracking Glow ──────────────────────────────────────────────────────

const MouseTrackingGlow = ({ plan, isActive }: { plan: Plan; isActive: boolean }) => {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isActive || !cardRef.current) return;

        const handleMouseMove = (e: MouseEvent) => {
            const card = cardRef.current;
            if (!card) return;
            const rect = card.getBoundingClientRect();
            setMousePos({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            });
        };

        const card = cardRef.current;
        card.addEventListener('mousemove', handleMouseMove);
        return () => card.removeEventListener('mousemove', handleMouseMove);
    }, [isActive]);

    return (
        <div ref={cardRef} className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
            <motion.div
                className={`absolute w-48 h-48 rounded-full bg-gradient-radial ${plan.gradient} opacity-20 blur-3xl`}
                animate={isActive ? {
                    x: mousePos.x - 96,
                    y: mousePos.y - 96,
                } : { opacity: 0 }}
                transition={{ type: 'spring', stiffness: 150, damping: 20 }}
            />
        </div>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────

export const PlanSelectorView = () => {
    const [activeIndex, setActiveIndex] = useState(1);
    const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [showBurst, setShowBurst] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const constraintsRef = useRef(null);

    const activePlan = PLANS[activeIndex];

    const goNext = () => setActiveIndex((i) => Math.min(i + 1, PLANS.length - 1));
    const goPrev = () => setActiveIndex((i) => Math.max(i - 1, 0));

    const handleSelect = (plan: Plan) => {
        setSelectedPlan(plan.id);
        setConfirming(true);
        setShowBurst(true);
        setTimeout(() => setShowBurst(false), 1000);
        setTimeout(() => setConfirming(false), 2200);
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') goPrev();
            if (e.key === 'ArrowLeft') goNext();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [activeIndex]);

    return (
        <div className="w-full h-full bg-background overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-16 pt-6">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

                {/* ─── Enhanced Header with Floating Elements ─────────────── */}
                <motion.div
                    className="text-center space-y-3 relative"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    {/* Floating decorative elements */}
                    <div className="absolute inset-0 pointer-events-none overflow-visible">
                        {[...Array(6)].map((_, i) => (
                            <motion.div
                                key={i}
                                className="absolute"
                                style={{
                                    left: `${20 + i * 12}%`,
                                    top: i % 2 === 0 ? '-10%' : '110%',
                                }}
                                animate={{
                                    y: [0, -15, 0],
                                    rotate: [0, 360],
                                    opacity: [0.1, 0.3, 0.1],
                                }}
                                transition={{
                                    duration: 3 + i * 0.5,
                                    repeat: Infinity,
                                    delay: i * 0.2,
                                    ease: 'easeInOut',
                                }}
                            >
                                <Star size={16} className="text-[var(--accent)]" />
                            </motion.div>
                        ))}
                    </div>

                    <div className="flex items-center justify-center gap-3 mb-3">
                        <motion.div
                            animate={{
                                rotate: [0, 15, -15, 0],
                                scale: [1, 1.3, 1],
                                filter: ['brightness(1)', 'brightness(1.5)', 'brightness(1)'],
                            }}
                            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                        >
                            <Sparkles size={22} className="text-[var(--accent)]" />
                        </motion.div>
                        <motion.span
                            className="text-xs font-black text-[var(--accent)] tracking-widest uppercase"
                            animate={{ opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            Pro Plans
                        </motion.span>
                        <motion.div
                            animate={{
                                rotate: [0, -15, 15, 0],
                                scale: [1, 1.3, 1],
                                filter: ['brightness(1)', 'brightness(1.5)', 'brightness(1)'],
                            }}
                            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, delay: 0.3 }}
                        >
                            <Sparkles size={22} className="text-[var(--accent)]" />
                        </motion.div>
                    </div>

                    <motion.h1
                        className="text-3xl font-black text-[var(--text-primary)]"
                        animate={{
                            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                        }}
                        transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                    >
                        پلن اشتراک خود را انتخاب کنید
                    </motion.h1>

                    <p className="text-sm text-[var(--text-muted)] max-w-xl mx-auto leading-relaxed">
                        هر پلن طراحی شده تا دقیقاً با نیاز شما هماهنگ باشد. هر زمان قابل ارتقاء است.
                    </p>

                    {/* Trending indicator */}
                    <motion.div
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] shadow-sm"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <TrendingUp size={12} className="text-green-500" />
                        <span className="text-[10px] font-bold text-[var(--text-muted)]">
                            +۲۳٪ کاربران این ماه پلن خود را ارتقاء دادند
                        </span>
                    </motion.div>
                </motion.div>

                {/* ─── Enhanced Tier Indicators with Progress ──────────────── */}
                <div className="flex items-center justify-center gap-3">
                    {PLANS.map((plan, i) => (
                        <motion.button
                            key={plan.id}
                            onClick={() => setActiveIndex(i)}
                            onHoverStart={() => setHoveredIndex(i)}
                            onHoverEnd={() => setHoveredIndex(null)}
                            className="flex flex-col items-center gap-1.5 group relative"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {/* Hover glow */}
                            {hoveredIndex === i && (
                                <motion.div
                                    layoutId="tier-hover"
                                    className="absolute -inset-2 rounded-2xl"
                                    style={{ backgroundColor: plan.accentColor + '10' }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                />
                            )}

                            <div className="relative">
                                <motion.div
                                    className={`h-2 rounded-full bg-gradient-to-r ${plan.gradient} relative overflow-hidden`}
                                    animate={{
                                        width: activeIndex === i ? 40 : 12,
                                        opacity: activeIndex === i ? 1 : 0.4,
                                    }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                >
                                    {activeIndex === i && (
                                        <motion.div
                                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                                            animate={{ x: ['-100%', '200%'] }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                                        />
                                    )}
                                </motion.div>
                            </div>

                            <motion.span
                                className={`text-[10px] font-black relative z-10`}
                                animate={{
                                    opacity: activeIndex === i ? 1 : 0.5,
                                    y: activeIndex === i ? 0 : 2,
                                    scale: activeIndex === i ? 1 : 0.9,
                                }}
                                style={{
                                    background: activeIndex === i
                                        ? `linear-gradient(to right, ${plan.accentColor}, ${plan.accentColor})`
                                        : undefined,
                                    WebkitBackgroundClip: activeIndex === i ? 'text' : undefined,
                                    WebkitTextFillColor: activeIndex === i ? 'transparent' : undefined,
                                    color: activeIndex === i ? 'transparent' : 'var(--text-muted)',
                                }}
                            >
                                {plan.nameEn}
                            </motion.span>
                        </motion.button>
                    ))}
                </div>

                {/* ─── Ultra-Enhanced Main Card Carousel ──────────────────── */}
                <div className="relative flex items-center justify-center gap-6 px-2" ref={constraintsRef}>

                    {/* Enhanced Navigation Buttons */}
                    <motion.button
                        onClick={goPrev}
                        disabled={activeIndex === 0}
                        whileHover={{ scale: 1.15, rotate: -5 }}
                        whileTap={{ scale: 0.9 }}
                        className="flex-shrink-0 w-11 h-11 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-lg backdrop-blur-sm z-20 relative overflow-hidden group"
                    >
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/0 via-[var(--accent)]/10 to-[var(--accent)]/0"
                            animate={{ x: ['-100%', '200%'] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        />
                        <ChevronRight size={20} className="relative z-10" strokeWidth={2.5} />
                    </motion.button>

                    {/* Cards Stack with Enhanced Effects */}
                    <div className="relative flex-1 h-[600px] flex items-center justify-center overflow-visible perspective-1000">
                        {PLANS.map((plan, i) => {
                            const offset = i - activeIndex;
                            const absOffset = Math.abs(offset);
                            const isActive = offset === 0;
                      const isVisible = absOffset <= 2;

                            if (!isVisible) return null;

                            return (
                                <motion.div
                                    key={plan.id}
                                    className={`absolute cursor-pointer select-none`}
                                    style={{ position: 'absolute' }}
                                    animate={{
                                        x: offset * 220,
                                        scale: isActive ? 1 : 0.82 - absOffset * 0.06,
                                        opacity: isActive ? 1 : 0.5 - absOffset * 0.15,
                                        rotateY: offset * -12,
                                        zIndex: 10 - absOffset,
                                        filter: isActive ? 'blur(0px)' : `blur(${absOffset * 1.5}px)`,
                                    }}
                                    transition={{
                                        type: 'spring',
                                        stiffness: 300,
                                        damping: 30,
                                    }}
                                    onClick={() => !isActive && setActiveIndex(i)}
                                    whileHover={isActive ? { y: -6 } : {}}
                                >
                                    {/* ── Card Shell ── */}
                                    <div
                                        className={`
                                            relative w-72 rounded-3xl overflow-hidden
                                            bg-[var(--bg-card)] border-2
                                            ${isActive ? plan.border : 'border-[var(--border)]'}
                                            ${isActive ? plan.glow : ''}
                                            transition-shadow duration-500
                                        `}
                                        style={{ minHeight: 520 }}
                                    >
                                        {/* Layered background effects */}
                                        <LiquidMorph plan={plan} isActive={isActive} />
                                        <RotatingRings plan={plan} isActive={isActive} />
                                        <MagneticParticles plan={plan} isActive={isActive} />
                                        <EnhancedShimmer plan={plan} isActive={isActive} />
                                        <AnimatedBorderGlow plan={plan} isActive={isActive} />
                                        <MouseTrackingGlow plan={plan} isActive={isActive} />

                                        {/* Top gradient bar */}
                                        <div className={`h-1.5 w-full bg-gradient-to-r ${plan.gradient} relative overflow-hidden`}>
                                            {isActive && (
                                                <motion.div
                                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                                                    animate={{ x: ['-100%', '200%'] }}
                                                    transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                                                />
                                            )}
                                        </div>

                                        <div className="p-6 space-y-5 relative z-10">

                                            {/* Badge */}
                                            <AnimatePresence>
                                                {plan.badge && isActive && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -10, scale: 0.8 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.8 }}
                                                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-gradient-to-r ${plan.gradient} text-white shadow-lg`}
                                                    >
                                                        <Star size={9} fill="white" />
                                                        {plan.badge}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* Icon block */}
                                            <div className="flex items-center justify-between">
                                                <motion.div
                                                    className={`w-14 h-14 rounded-2xl ${plan.iconBg} flex items-center justify-center border border-[var(--border)] relative overflow-hidden`}
                                                    animate={isActive ? {
                                                        boxShadow: [
                                                            `0 0 0px 0px ${plan.accentColor}00`,
                                                            `0 0 20px 4px ${plan.accentColor}40`,
                                                            `0 0 0px 0px ${plan.accentColor}00`,
                                                        ],
                                                    } : {}}
                                                    transition={{ duration: 2, repeat: Infinity }}
                                                >
                                                    <motion.div
                                                        animate={isActive ? {
                                                            rotate: [0, -10, 10, 0],
                                                            scale: [1, 1.15, 1],
                                                        } : {}}
                                                        transition={{ duration: 3, repeat: Infinity, repeatDelay: 1 }}
                                                    >
                                                        <svg width="0" height="0" className="absolute">
                                                            <defs>
                                                                <linearGradient id={`icon-grad-${plan.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                                                    <stop offset="0%" stopColor={plan.accentColor} />
                                                                    <stop offset="100%" stopColor={plan.accentColor + '99'} />
                                                                </linearGradient>
                                                            </defs>
                                                        </svg>
                                                        <plan.icon
                                                            size={26}
                                                            strokeWidth={2}
                                                            style={{ stroke: `url(#icon-grad-${plan.id})` }}
                                                        />
                                                    </motion.div>
                                                    {/* Icon inner shimmer */}
                                                    {isActive && (
                                                        <motion.div
                                                            className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"
                                                            animate={{ opacity: [0, 0.5, 0] }}
                                                            transition={{ duration: 2, repeat: Infinity }}
                                                        />
                                                    )}
                                                </motion.div>

                                                {/* Pulsing stats */}
                                                <PulsingStats stats={plan.stats} plan={plan} isActive={isActive} />
                                            </div>

                                            {/* Price */}
                                            <div>
                                                <motion.div
                                                    className={`text-4xl font-black bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent leading-none`}
                                                    animate={isActive ? { scale: [1, 1.03, 1] } : {}}
                                                    transition={{ duration: 3, repeat: Infinity }}
                                                >
                                                    {plan.price}
                                                </motion.div>
                                                <div className="text-[11px] text-[var(--text-muted)] font-medium mt-1">
                                                    {plan.priceUnit}
                                                </div>
                                            </div>

                                            {/* Name + description */}
                                            <div>
                                                <h3 className={`text-lg font-black bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent`}>
                                                    پلن {plan.name}
                                                </h3>
                                                <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                                                    {plan.description}
                                                </p>
                                            </div>

                                            {/* Features */}
                                            <div className="space-y-2">
                                                {plan.features.map((feature, fi) => (
                                                    <motion.div
                                                        key={fi}
                                                        className="flex items-center gap-2.5"
                                                        initial={false}
                                                        animate={isActive ? { x: 0, opacity: 1 } : { x: 0, opacity: 0.7 }}
                                                        transition={{ delay: fi * 0.05 }}
                                                    >
                                                        <motion.div
                                                            className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                                feature.included
                                                                    ? `bg-gradient-to-br ${plan.gradient}`
                                                                    : 'bg-[var(--bg-element)]'
                                                            }`}
                                                            animate={isActive && feature.included ? {
                                                                scale: [1, 1.2, 1],
                                                            } : {}}
                                                            transition={{ delay: fi * 0.1, duration: 0.5 }}
                                                        >
                                                            <Check
                                                                size={9}
                                                                strokeWidth={3}
                                                                className={feature.included ? 'text-white' : 'text-[var(--text-muted)] opacity-30'}
                                                            />
                                                        </motion.div>
                                                        <span className={`text-xs ${feature.included ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] line-through opacity-50'}`}>
                                                            {feature.label}
                                                        </span>
                                                        {feature.included && plan.id === 'diamond' && (
                                                            <motion.div
                                                                animate={{ rotate: 360 }}
                                                                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                                            >
                                                                <Infinity size={10} className="text-[var(--accent)] opacity-60" />
                                                            </motion.div>
                                                        )}
                                                    </motion.div>
                                                ))}
                                            </div>

                                            {/* CTA Button */}
                                            <div className="relative pt-1">
                                                <motion.button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSelect(plan);
                                                    }}
                                                    whileHover={{ scale: 1.03, y: -2 }}
                                                    whileTap={{ scale: 0.97 }}
                                                    disabled={confirming && selectedPlan === plan.id}
                                                    className={`w-full py-3 rounded-2xl font-black text-sm relative overflow-hidden transition-all
                                                        ${selectedPlan === plan.id
                                                        ? `bg-gradient-to-r ${plan.gradient} text-white shadow-lg`
                                                        : 'bg-[var(--bg-element)] text-[var(--text-primary)] border-2 border-[var(--border)] hover:border-[var(--accent)]'
                                                    }
                                                    `}
                                                >
                                                    {/* Button shimmer */}
                                                    {selectedPlan === plan.id && (
                                                        <motion.div
                                                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                                            animate={{ x: ['-100%', '200%'] }}
                                                            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                                                        />
                                                    )}
                                                    <AnimatePresence mode="wait">
                                                        {confirming && selectedPlan === plan.id ? (
                                                            <motion.span
                                                                key="confirmed"
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                exit={{ opacity: 0, y: -10 }}
                                                                className="relative z-10 flex items-center justify-center gap-2"
                                                            >
                                                                <motion.div
                                                                    animate={{ rotate: 360 }}
                                                                    transition={{ duration: 0.5 }}
                                                                >
                                                                    <Check size={14} strokeWidth={3} />
                                                                </motion.div>
                                                                انتخاب شد!
                                                            </motion.span>
                                                        ) : selectedPlan === plan.id ? (
                                                            <motion.span
                                                                key="active"
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                exit={{ opacity: 0, y: -10 }}
                                                                className="relative z-10"
                                                            >
                                                                پلن فعلی شما
                                                            </motion.span>
                                                        ) : (
                                                            <motion.span
                                                                key="idle"
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                exit={{ opacity: 0, y: -10 }}
                                                                className="relative z-10"
                                                            >
                                                                انتخاب این پلن
                                                            </motion.span>
                                                        )}
                                                    </AnimatePresence>
                                                </motion.button>

                                                {/* Burst effect on confirm */}
                                                <AnimatePresence>
                                                    {showBurst && selectedPlan === plan.id && (
                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
                                                            <EnhancedConfirmBurst plan={plan} />
                                                        </div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Right nav button */}
                    <motion.button
                        onClick={goNext}
                        disabled={activeIndex === PLANS.length - 1}
                        whileHover={{ scale: 1.15, rotate: 5 }}
                        whileTap={{ scale: 0.9 }}
                        className="flex-shrink-0 w-11 h-11 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-lg backdrop-blur-sm z-20 relative overflow-hidden group"
                    >
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/0 via-[var(--accent)]/10 to-[var(--accent)]/0"
                            animate={{ x: ['-100%', '200%'] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        />
                        <ChevronLeft size={20} className="relative z-10" strokeWidth={2.5} />
                    </motion.button>
                </div>

                {/* ─── Active Plan Label ───────────────────────────────────── */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activePlan.id}
                        className="text-center space-y-1"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                    >
                        <h2 className={`text-xl font-black bg-gradient-to-r ${activePlan.gradient} bg-clip-text text-transparent`}>
                            پلن {activePlan.name}
                        </h2>
                        <p className="text-xs text-[var(--text-muted)]">{activePlan.description}</p>
                    </motion.div>
                </AnimatePresence>

                {/* ─── Comparison Footer ───────────────────────────────────── */}
                <motion.div
                    className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 text-center space-y-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    <div className="flex items-center justify-center gap-2 text-[var(--text-muted)]">
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <Shield size={13} className="text-[var(--accent)]" />
                        </motion.div>
                        <span className="text-[11px] font-semibold">
                            همه پلن‌ها شامل: دسترسی به پلتفرم، بروزرسانی رایگان و امنیت داده می‌شوند
                        </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] opacity-60">
                        برای مقایسه کامل روی هر پلن کلیک کنید
                    </p>
                </motion.div>

            </div>
        </div>
    );
};

export default PlanSelectorView;
