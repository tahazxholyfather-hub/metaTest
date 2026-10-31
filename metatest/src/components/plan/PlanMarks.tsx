import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Player } from '@lordicon/react';
import ribbon from '../../assets/wired-gradient-3235-badge-ribbon-in-reveal.json';
import ribbonFlat from '../../assets/wired-flat-3235-badge-ribbon.json';
import coin from '../../assets/wired-gradient-290-coin.json';
import gem from '../../assets/wjdlpfml.json';
import stars from '../../assets/plan-icons/wired-flat-1865-shooting-stars-hover-pinch.json';
import lab from '../../assets/plan-icons/wired-flat-438-lab-bottle-round-hover-oscillate.json';
import sphere from '../../assets/plan-icons/wired-flat-1383-sphere-hover-pinch.json';

export const PLAN_ICON_OPTIONS = [
    { id: 'ribbon', label: 'روبان', data: ribbon },
    { id: 'coin', label: 'سکه', data: coin },
    { id: 'gem', label: 'گوهر', data: gem },
    { id: 'stars', label: 'ستاره', data: stars },
    { id: 'lab', label: 'آزمایشگاه', data: lab },
    { id: 'sphere', label: 'کره', data: sphere },
] as const;

export type PlanIconKey = (typeof PLAN_ICON_OPTIONS)[number]['id'];

export function resolvePlanIcon(iconKey?: string | null, planId?: string | null, name?: string | null) {
    const known = PLAN_ICON_OPTIONS.find((item) => item.id === iconKey);
    if (known) return known.data;
    const key = String(planId || '').toLowerCase();
    const label = String(name || '');
    if (key.includes('diamond') || key === 'epic' || label.includes('الماس')) return gem;
    if (key.includes('gold') || label.includes('طلا')) return coin;
    if (key.includes('silver') || label.includes('نقر')) return stars;
    if (key.includes('bronze') || label.includes('برنز')) return ribbon;
    return lab;
}

export function PlanLordIcon({
    iconKey,
    planId,
    name,
    color,
    size = 72,
    playKey,
}: {
    iconKey?: string | null;
    planId?: string | null;
    name?: string | null;
    color?: string | null;
    size?: number;
    playKey?: string | number;
}) {
    const playerRef = useRef<Player>(null);
    const icon = resolvePlanIcon(iconKey, planId, name);

    useEffect(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) return;
        const timeout = window.setTimeout(() => playerRef.current?.playFromBeginning(), 40);
        return () => window.clearTimeout(timeout);
    }, [playKey, icon]);

    return (
        <span className="inline-flex items-center justify-center" aria-hidden>
            <Player ref={playerRef} icon={icon} size={size} colorize={color || undefined} />
        </span>
    );
}

export function DaysRing({
    progress,
    days,
    size = 64,
    caption = 'روز',
}: {
    progress: number;
    days: number | string;
    size?: number;
    caption?: string;
}) {
    const pct = Math.max(0, Math.min(100, progress));
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const [drawn, setDrawn] = useState(0);
    useEffect(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) {
            setDrawn(pct);
            return;
        }
        setDrawn(0);
        const id = window.requestAnimationFrame(() => setDrawn(pct));
        return () => window.cancelAnimationFrame(id);
    }, [pct]);
    const offset = circumference - (drawn / 100) * circumference;
    const numberSize = Math.max(11, Math.round(size * 0.22));
    const captionSize = Math.max(8, Math.round(size * 0.13));
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`${days} ${caption}`}>
            <svg className="h-full w-full -rotate-90" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r={radius} stroke="currentColor" strokeWidth="3" fill="none" className="text-[var(--border)]" />
                <circle
                    cx="20"
                    cy="20"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    className="text-[var(--accent)] motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-black leading-none tabular-nums text-[var(--text-primary)]" style={{ fontSize: numberSize }}>
                    {typeof days === 'number' ? days.toLocaleString('fa-IR') : days}
                </span>
                <span className="mt-0.5 font-bold leading-none text-[var(--text-muted)]" style={{ fontSize: captionSize }}>{caption}</span>
            </span>
        </div>
    );
}

export function durationTabLabel(days: number | null | undefined, unlimited?: boolean) {
    if (unlimited || days == null) return 'نامحدود';
    if (days <= 31) return 'یک ماهه';
    if (days <= 100) return '۳ ماهه';
    if (days <= 200) return '۶ ماهه';
    if (days <= 380) return 'یک ساله';
    return `${days.toLocaleString('fa-IR')} روزه`;
}

export type ShopPlan = {
    id: string;
    name: string;
    days: number | null;
    unlimited?: boolean;
    price: number;
    comparePrice?: number | null;
    attributes?: string[];
    iconKey?: string | null;
    dailyCoins?: number | null;
    savings?: { amount: number; versusName: string } | null;
    purchasable?: boolean;
    loyaltyPercent?: number;
    popular?: boolean;
    iconColors?: { primary?: string; secondary?: string };
    shimmerClass?: string;
};

export function planBenefitLines(plan: ShopPlan, extras = true) {
    const lines = [...(plan.attributes || [])];
    if (lines.length === 0) {
        lines.push('دسترسی به امکانات ویژه');
        lines.push('آزمون چندنفره و لابی');
        lines.push('پاسخ تشریحی بدون سقف');
    }
    if (extras && plan.dailyCoins) {
        lines.push(`روزانه ${Number(plan.dailyCoins).toLocaleString('fa-IR')} سکه هوش مصنوعی`);
    }
    if (extras && plan.savings && plan.savings.amount > 0) {
        lines.push(`نسبت به ${plan.savings.versusName}، ${plan.savings.amount.toLocaleString('fa-IR')} تومان کمتر`);
    }
    if (extras && plan.comparePrice && plan.comparePrice > plan.price) {
        lines.push(`${(plan.comparePrice - plan.price).toLocaleString('fa-IR')} تومان کمتر از قیمت اصلی`);
    }
    return lines;
}

export function pricePerDay(price: number, days: number | null | undefined) {
    if (!days || days <= 0) return null;
    return Math.round(price / days);
}

/** Nearest thousand toman, so 7,744 reads as 8,000. */
export function roundToman(value: number) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (value >= 1000) return Math.round(value / 1000) * 1000;
    if (value >= 100) return Math.round(value / 100) * 100;
    return Math.round(value);
}

export function equivalentPerDay(price: number, days: number | null | undefined) {
    if (!days || days <= 0 || price <= 0) return null;
    return roundToman(price / days);
}

export function planTint(planId?: string | null, name?: string | null, explicit?: string | null) {
    if (explicit) return explicit;
    const blob = `${planId || ''} ${name || ''}`;
    const key = blob.toLowerCase();
    if (key.includes('diamond') || key.includes('epic') || blob.includes('الماس')) return '#06b6d4';
    if (key.includes('gold') || blob.includes('طلا')) return '#eab308';
    if (key.includes('silver') || blob.includes('نقر')) return '#94a3b8';
    if (key.includes('bronze') || blob.includes('برنز')) return '#d97706';
    return 'var(--accent)';
}

export function planShimmerClass(planId?: string | null, name?: string | null) {
    const blob = `${planId || ''} ${name || ''}`;
    const key = blob.toLowerCase();
    if (key.includes('diamond') || key.includes('epic') || blob.includes('الماس')) return 'shimmer-diamond';
    if (key.includes('gold') || blob.includes('طلا')) return 'shimmer-golden';
    if (key.includes('silver') || blob.includes('نقر')) return 'shimmer-silver';
    if (key.includes('bronze') || blob.includes('برنز')) return 'shimmer-bronze';
    return 'shimmer-silver';
}

export function PlanDaysCircle({
    progress,
    days,
    size = 58,
    unlimited = false,
}: {
    progress: number;
    days: number | string;
    size?: number;
    unlimited?: boolean;
}) {
    const pct = unlimited ? 100 : Math.max(0, Math.min(100, progress));
    const radius = 15.5;
    const circumference = 2 * Math.PI * radius;
    const [drawn, setDrawn] = useState(0);
    useEffect(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) {
            setDrawn(pct);
            return;
        }
        setDrawn(0);
        const id = window.requestAnimationFrame(() => setDrawn(pct));
        return () => window.cancelAnimationFrame(id);
    }, [pct]);
    const offset = circumference - (drawn / 100) * circumference;
    const label = unlimited ? '∞' : (typeof days === 'number' ? days.toLocaleString('fa-IR') : days);
    const numberSize = Math.max(9, Math.round(size * 0.17));
    const captionSize = Math.max(7, Math.round(size * 0.09));
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={unlimited ? 'نامحدود' : `${label} روز`}>
            <svg className="h-full w-full -rotate-90" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r={radius} stroke="var(--border-strong)" strokeWidth="3" fill="none" />
                <circle
                    cx="20"
                    cy="20"
                    r={radius}
                    stroke="var(--accent)"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
                />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-black leading-none tabular-nums text-[var(--accent)]" style={{ fontSize: numberSize }}>{label}</span>
                {!unlimited && (
                    <span className="mt-0.5 font-bold leading-none text-[var(--text-muted)]" style={{ fontSize: captionSize }}>روز</span>
                )}
            </span>
        </div>
    );
}

export function PlanStatusCard({
    planId,
    name,
    color,
    progress,
    days,
    unlimited = false,
    circleSize = 56,
    iconSize = 34,
    onClick,
}: {
    planId?: string | null;
    name: string;
    color?: string | null;
    progress: number;
    days: number;
    unlimited?: boolean;
    circleSize?: number;
    iconSize?: number;
    onClick?: () => void;
}) {
    const tint = planTint(planId, name, color);
    const body = (
        <>
            <span className="flex shrink-0 flex-col items-center">
                <PlanRibbonBadge planId={planId} name={name} color={tint} size={iconSize} playKey={`status-${planId}-${name}`} />
                <span className="plan-title-shine mt-1 whitespace-nowrap text-center text-[11px] font-black leading-none" style={{ '--shine': tint } as CSSProperties}>{name}</span>
            </span>
            <PlanDaysCircle progress={progress} days={days} unlimited={unlimited} size={circleSize} />
        </>
    );
    const className = 'flex w-full items-center justify-between gap-2 rounded-2xl border border-solid bg-transparent px-2.5 py-2 shadow-none';
    const style = { borderColor: tint, borderWidth: 2 };
    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={`${className} cursor-pointer`} style={style} aria-label={name}>
                {body}
            </button>
        );
    }
    return (
        <div className={className} style={style}>
            {body}
        </div>
    );
}

export function PlanRibbonBadge({
    planId,
    name,
    color,
    size = 72,
    playKey,
}: {
    planId?: string | null;
    name?: string | null;
    color?: string | null;
    size?: number;
    playKey?: string | number;
}) {
    const playerRef = useRef<Player>(null);
    const tint = planTint(planId, name, color);

    useEffect(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) return;
        const timeout = window.setTimeout(() => playerRef.current?.playFromBeginning(), 40);
        return () => window.clearTimeout(timeout);
    }, [playKey]);

    return (
        <span className="inline-flex items-center justify-center" aria-hidden>
            <Player ref={playerRef} icon={ribbonFlat} size={size} state="in-reveal" colorize={tint} />
        </span>
    );
}

export function PlanRemainBar({
    progress,
    days,
    unlimited = false,
    compact = false,
}: {
    progress: number;
    days: number;
    unlimited?: boolean;
    compact?: boolean;
}) {
    const pct = unlimited ? 100 : Math.max(0, Math.min(100, progress));
    const label = unlimited ? 'نامحدود' : `${days.toLocaleString('fa-IR')} روز`;
    return (
        <div className="min-w-0 flex-1" aria-label={label}>
            {!compact && (
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-black leading-none tabular-nums text-[var(--text-primary)]">
                        {unlimited ? '∞' : days.toLocaleString('fa-IR')}
                    </span>
                    <span className="text-[9px] font-bold text-[var(--text-muted)]">{unlimited ? 'نامحدود' : 'روز'}</span>
                </div>
            )}
            <div className="relative h-[3px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text-primary)_14%,transparent)]">
                <motion.span
                    className="absolute inset-y-0 right-0 rounded-full bg-[var(--accent)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.7 }}
                    style={{ boxShadow: '0 0 10px color-mix(in srgb, var(--accent) 65%, transparent)' }}
                />
            </div>
        </div>
    );
}

const GLASS = 'M22 16 H78 C78 16 74 34 64 48 C56 58 54 62 54 66 C54 70 56 74 64 84 C74 98 78 116 78 128 H22 C22 128 26 98 36 84 C44 74 46 70 46 66 C46 62 44 58 36 48 C26 34 22 16 22 16 Z';
const TOP_BULB = 'M24 18 H76 C76 18 72 34 64 46 C56 56 54 60 50 64 C46 60 44 56 36 46 C28 34 24 18 24 18 Z';
const BOT_BULB = 'M24 126 H76 C76 126 72 110 64 98 C56 88 54 82 50 76 C46 82 44 88 36 98 C28 110 24 126 24 126 Z';

export function Hourglass({
    progress,
    days,
    size = 108,
    color,
    caption = 'روز باقی‌مانده',
}: {
    progress: number;
    days: number | string;
    size?: number;
    color?: string;
    caption?: string;
}) {
    const uid = useId().replace(/:/g, '');
    const sand = color || 'var(--accent)';
    const remaining = Math.max(0, Math.min(100, progress));
    const spent = 100 - remaining;
    const topSand = 46 * Math.pow(remaining / 100, 0.72);
    const botSand = 50 * Math.pow(spent / 100, 1.2);
    const flowing = remaining > 2 && remaining < 98;
    const dayLabel = typeof days === 'number' ? days.toLocaleString('fa-IR') : days;

    return (
        <div className="flex shrink-0 flex-col items-center" style={{ width: size }} aria-label={`${dayLabel} ${caption}`}>
            <svg viewBox="0 0 100 146" width={size} height={size * 1.32} aria-hidden>
                <defs>
                    <linearGradient id={`${uid}-sand`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={sand} stopOpacity="1" />
                        <stop offset="100%" stopColor={sand} stopOpacity="0.62" />
                    </linearGradient>
                    <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.42" />
                        <stop offset="42%" stopColor="#ffffff" stopOpacity="0.04" />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0.16" />
                    </linearGradient>
                    <clipPath id={`${uid}-top`}><path d={TOP_BULB} /></clipPath>
                    <clipPath id={`${uid}-bot`}><path d={BOT_BULB} /></clipPath>
                </defs>

                <rect x="18" y="8" width="64" height="10" rx="3" fill={sand} />
                <rect x="18" y="128" width="64" height="10" rx="3" fill={sand} />
                <rect x="22" y="14" width="56" height="3" rx="1" fill="#fff" opacity="0.28" />

                <path
                    d={GLASS}
                    fill="color-mix(in srgb, var(--bg-card) 78%, transparent)"
                    stroke="color-mix(in srgb, var(--text-primary) 28%, transparent)"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                />
                <path d={GLASS} fill={`url(#${uid}-glass)`} />

                <g clipPath={`url(#${uid}-top)`}>
                    {topSand > 0.6 && (
                        <>
                            <rect x="20" y={64 - topSand} width="60" height={topSand + 2} fill={`url(#${uid}-sand)`} />
                            <ellipse cx="50" cy={64 - topSand + 1} rx="16" ry="2.4" fill={sand} />
                        </>
                    )}
                </g>
                <g clipPath={`url(#${uid}-bot)`}>
                    {botSand > 0.6 && (
                        <>
                            <rect x="20" y={126 - botSand} width="60" height={botSand + 4} fill={`url(#${uid}-sand)`} />
                            <ellipse cx="50" cy={126 - botSand + 1.2} rx={10 + botSand / 10} ry="2.2" fill={sand} opacity="0.9" />
                        </>
                    )}
                </g>

                {flowing && (
                    <g className="motion-reduce:hidden">
                        <line className="hourglass-stream" x1="50" y1="64" x2="50" y2="78" stroke={sand} strokeWidth="1.5" strokeLinecap="round" />
                        <circle className="hourglass-grain" cx="50" cy="64" r="1.25" fill={sand} />
                        <circle className="hourglass-grain hourglass-grain-b" cx="50" cy="64" r="1.05" fill={sand} />
                    </g>
                )}

                <path d="M32 28c6 2 10 10 5 18" fill="none" stroke="#fff" strokeOpacity="0.62" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <p className="mt-0.5 text-center">
                <span className="block text-[26px] font-black leading-none tabular-nums text-[var(--text-primary)]">{dayLabel}</span>
                <span className="mt-1 block text-[11px] font-bold text-[var(--text-muted)]">{caption}</span>
            </p>
        </div>
    );
}
