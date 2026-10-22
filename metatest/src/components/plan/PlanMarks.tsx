import { useEffect, useRef, useState } from 'react';
import { Player } from '@lordicon/react';
import ribbon from '../../assets/wired-gradient-3235-badge-ribbon-in-reveal.json';
import coin from '../../assets/wired-gradient-290-coin.json';
import gem from '../../assets/wjdlpfml.json';
import stars from '../../../public/lordicons/wired-flat-1865-shooting-stars-hover-pinch.json';
import lab from '../../../public/lordicons/wired-flat-438-lab-bottle-round-hover-oscillate.json';
import sphere from '../../../public/lordicons/wired-flat-1383-sphere-hover-pinch.json';

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
