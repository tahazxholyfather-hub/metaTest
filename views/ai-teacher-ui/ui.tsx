/* Shared AI Teacher UI primitives — premium educational product */
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Coins, X, Zap } from 'lucide-react';

export const AI_HEADER_H_DESKTOP = '3.5rem';
export const AI_HEADER_H_MOBILE = '5.75rem';

export const springSoft = { type: 'spring' as const, stiffness: 420, damping: 34 };
export const springTab = { type: 'spring' as const, stiffness: 380, damping: 32 };
export const easeOut = [0.22, 1, 0.36, 1] as const;

export function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < breakpoint : true
    );
    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
        const apply = () => setIsMobile(mq.matches);
        apply();
        mq.addEventListener?.('change', apply);
        return () => mq.removeEventListener?.('change', apply);
    }, [breakpoint]);
    return isMobile;
}

export function usePrefersReducedMotion() {
    return !!useReducedMotion();
}

export function AiPageShell({
    children,
    className = '',
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`ai-teacher-root relative flex-1 flex flex-col min-h-0 h-full overflow-hidden bg-[var(--bg-app)] ${className}`}
            dir="rtl"
        >
            {children}
        </div>
    );
}

export function HiddenScroll({
    children,
    className = '',
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`overflow-y-auto overscroll-contain hide-scrollbar ${className}`}>
            {children}
        </div>
    );
}

export function ChatScroll({
    children,
    className = '',
    contentClassName = '',
    topFade = false,
}: {
    children: React.ReactNode;
    className?: string;
    contentClassName?: string;
    topFade?: boolean;
}) {
    return (
        <div className={`relative min-h-0 flex-1 ${className}`}>
            <div className={`h-full overflow-y-auto overscroll-contain chat-scrollbar ${contentClassName}`}>
                {children}
            </div>
            {topFade && (
                <div className="ai-chat-fade-top pointer-events-none absolute inset-x-0 top-0 z-10" aria-hidden />
            )}
        </div>
    );
}

export function GraySpinner({ size = 22, className = '' }: { size?: number; className?: string }) {
    return (
        <div
            className={`inline-block animate-spin rounded-full border-2 border-[var(--text-muted)]/25 border-t-[var(--text-muted)] ${className}`}
            style={{ width: size, height: size }}
            role="status"
            aria-label="در حال بارگذاری"
        />
    );
}

/** Professional slow text shimmer — only while AI is working */
export function AiWorkingStatus({ text }: { text: string }) {
    const reduce = usePrefersReducedMotion();
    return (
        <motion.span
            key={text}
            initial={{ opacity: 0, y: 1 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -1 }}
            transition={{ duration: 0.25, ease: easeOut }}
            className={`text-[11px] truncate max-w-[10rem] ${reduce ? 'text-[var(--text-muted)]' : 'ai-text-shimmer'}`}
        >
            {text}
        </motion.span>
    );
}

/** Online / working status line for headers & sidebar */
export function ChatStatusLine({
    status,
    workingLabels,
}: {
    status: 'ready' | 'sending' | 'thinking' | 'generating' | 'error';
    workingLabels: Partial<Record<'sending' | 'thinking' | 'generating', string>>;
}) {
    const working = status === 'sending' || status === 'thinking' || status === 'generating';
    return (
        <AnimatePresence mode="wait" initial={false}>
            {working ? (
                <AiWorkingStatus
                    key={`w-${status}`}
                    text={
                        (status === 'sending' || status === 'thinking' || status === 'generating'
                            ? workingLabels[status]
                            : undefined) || '…'
                    }
                />
            ) : status === 'error' ? (
                <motion.span key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] text-rose-400">
                    خطا
                </motion.span>
            ) : (
                <motion.span
                    key="online"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]"
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    آنلاین
                </motion.span>
            )}
        </AnimatePresence>
    );
}

/** 3-dot typing indicator */
export function TypingIndicator({ className = '' }: { className?: string }) {
    const reduce = usePrefersReducedMotion();
    return (
        <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.22, ease: easeOut }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[14px] bg-[color-mix(in_srgb,var(--text-primary)_6%,var(--bg-card))] border border-[var(--border)]/60 ${className}`}
            role="status"
            aria-label="در حال نوشتن"
        >
            {[0, 1, 2].map((i) => (
                <motion.span
                    key={i}
                    className="block w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]"
                    animate={reduce ? { opacity: 0.7 } : { y: [0, -3.5, 0], opacity: [0.4, 1, 0.4] }}
                    transition={
                        reduce
                            ? {}
                            : { duration: 1.15, repeat: Infinity, ease: 'easeInOut', delay: i * 0.16 }
                    }
                />
            ))}
        </motion.div>
    );
}

/** Compact premium credit balance (legacy fallback) */
export function CreditBalance({
    balance,
    className = '',
}: {
    balance: number;
    className?: string;
}) {
    return (
        <motion.div
            key={balance}
            initial={{ scale: 0.96, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.22, ease: easeOut }}
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[10px] border border-[var(--border)]/80 bg-[color-mix(in_srgb,var(--bg-card)_70%,transparent)] text-[var(--text-primary)] ${className}`}
            aria-label={`اعتبار ${balance}`}
            dir="ltr"
        >
            <Coins size={14} className="text-[var(--color-primary-400)]" strokeWidth={2} />
            <span className="text-[12.5px] font-semibold tabular-nums tracking-tight">
                {balance.toLocaleString('fa-IR')}
            </span>
        </motion.div>
    );
}

function useCountdown(targetIso?: string) {
    const [left, setLeft] = useState('');
    useEffect(() => {
        if (!targetIso) return;
        const tick = () => {
            const ms = new Date(targetIso).getTime() - Date.now();
            if (ms <= 0) {
                setLeft('۰۰:۰۰:۰۰');
                return;
            }
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            const s = Math.floor((ms % 60000) / 1000);
            const pad = (n: number) => String(n).padStart(2, '0');
            setLeft(`${pad(h)}:${pad(m)}:${pad(s)}`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [targetIso]);
    return left;
}

/**
 * Energy meter — minimal circular progress of daily AI energy.
 * Colors: healthy → violet, low → amber, critical → rose.
 * When empty shows countdown to the next daily recharge.
 */
export function EnergyMeter({
    balance,
    dailyAllowance = 0,
    nextRefillAt,
    size = 30,
    compact = false,
    className = '',
}: {
    balance: number;
    dailyAllowance?: number;
    nextRefillAt?: string;
    size?: number;
    compact?: boolean;
    className?: string;
}) {
    const max = Math.max(dailyAllowance || 0, balance, 1);
    const pct = Math.max(0, Math.min(1, balance / max));
    const empty = balance <= 0;
    const countdown = useCountdown(empty ? nextRefillAt : undefined);

    const color = empty
        ? 'var(--error, #f43f5e)'
        : pct <= 0.2
          ? '#f43f5e'
          : pct <= 0.45
            ? '#f59e0b'
            : 'var(--color-primary-400)';

    const r = (size - 5) / 2;
    const c = 2 * Math.PI * r;

    return (
        <div
            className={`inline-flex items-center gap-2 ${className}`}
            aria-label={empty ? `انرژی تمام شد — شارژ بعدی ${countdown}` : `انرژی ${balance}`}
            title={empty ? 'شارژ روزانه بعدی' : 'انرژی روزانه'}
            dir="ltr"
        >
            <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="-rotate-90">
                    <circle
                        cx={size / 2} cy={size / 2} r={r}
                        fill="none" strokeWidth={2.5}
                        className="stroke-[var(--border)]"
                    />
                    <motion.circle
                        cx={size / 2} cy={size / 2} r={r}
                        fill="none" strokeWidth={2.5} strokeLinecap="round"
                        stroke={color}
                        strokeDasharray={c}
                        animate={{ strokeDashoffset: c * (1 - pct) }}
                        transition={{ duration: 0.6, ease: easeOut }}
                    />
                </svg>
                <Zap
                    size={size * 0.4}
                    className="absolute"
                    style={{ color }}
                    strokeWidth={2.4}
                    fill={empty ? 'none' : color}
                />
            </span>

            {!compact && (
                <AnimatePresence mode="wait" initial={false}>
                    {empty ? (
                        <motion.span
                            key="cd"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-[11px] font-semibold tabular-nums text-rose-400 tracking-tight"
                        >
                            {countdown || '۰۰:۰۰:۰۰'}
                        </motion.span>
                    ) : (
                        <motion.span
                            key={balance}
                            initial={{ opacity: 0.5, y: -2 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, ease: easeOut }}
                            className="text-[12.5px] font-semibold tabular-nums text-[var(--text-primary)] tracking-tight"
                        >
                            {balance.toLocaleString('fa-IR')}
                        </motion.span>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
}

/** Minimal pentagon/radar chart for teacher skills (SVG, RTL-safe) */
export function RadarChart({
    axes,
    size = 190,
    minimal = false,
    className = '',
}: {
    axes: { label: string; value: number }[]; // value 0..100
    size?: number;
    minimal?: boolean;
    className?: string;
}) {
    const n = Math.max(3, axes.length);
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * (minimal ? 0.32 : 0.34);
    const labelR = radius + (minimal ? 14 : 20);

    const point = (i: number, rr: number) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return [cx + rr * Math.cos(angle), cy + rr * Math.sin(angle)] as const;
    };

    const ringPoints = (scale: number) =>
        Array.from({ length: n }, (_, i) => point(i, radius * scale).join(',')).join(' ');

    const valuePoints = axes
        .map((a, i) => point(i, radius * Math.max(0.08, Math.min(1, a.value / 100))).join(','))
        .join(' ');

    const rings = minimal ? [1] : [1, 0.72, 0.44];

    return (
        <div className={`relative ${className}`} dir="ltr">
            <svg width={size} height={size} className="block mx-auto overflow-visible">
                {rings.map((s) => (
                    <polygon
                        key={s}
                        points={ringPoints(s)}
                        fill="none"
                        className="stroke-[var(--border)]"
                        strokeWidth={minimal ? 0.7 : s === 1 ? 1.1 : 0.6}
                    />
                ))}
                {Array.from({ length: n }, (_, i) => {
                    const [x, y] = point(i, radius);
                    return (
                        <line
                            key={i}
                            x1={cx} y1={cy} x2={x} y2={y}
                            className="stroke-[var(--border)]"
                            strokeWidth={minimal ? 0.4 : 0.5}
                        />
                    );
                })}
                <motion.polygon
                    points={valuePoints}
                    fill={minimal
                        ? 'color-mix(in srgb, var(--color-primary-500) 14%, transparent)'
                        : 'color-mix(in srgb, var(--color-primary-500) 22%, transparent)'}
                    stroke="var(--color-primary-400)"
                    strokeWidth={minimal ? 1.15 : 1.6}
                    strokeLinejoin="round"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.55, ease: easeOut }}
                    style={{ transformOrigin: `${cx}px ${cy}px` }}
                />
                {!minimal && axes.map((a, i) => {
                    const [x, y] = point(i, radius * Math.max(0.08, Math.min(1, a.value / 100)));
                    return <circle key={a.label} cx={x} cy={y} r={2.4} fill="var(--color-primary-400)" />;
                })}
                {axes.map((a, i) => {
                    const [x, y] = point(i, labelR);
                    return (
                        <text
                            key={a.label}
                            x={x} y={y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="fill-[var(--text-muted)]"
                            fontSize={minimal ? 8 : 10}
                            fontWeight={600}
                        >
                            {a.label}
                        </text>
                    );
                })}
            </svg>
        </div>
    );
}

export function SkillProgressBars({
    skills,
    active = true,
}: {
    skills: { label: string; value: number }[];
    active?: boolean;
}) {
    return (
        <div className="space-y-2.5 w-full">
            {skills.map((s) => (
                <div key={s.label} className="text-right">
                    <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-[11px] font-bold text-[var(--text-secondary)] truncate">{s.label}</span>
                        <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{s.value}٪</span>
                    </div>
                    <div className="h-[3px] w-full rounded-full bg-[var(--border)] overflow-hidden">
                        <motion.div
                            className="h-full rounded-full bg-[var(--color-primary-500)]"
                            initial={{ width: 0 }}
                            animate={{ width: active ? `${s.value}%` : 0 }}
                            transition={{ duration: 0.85, ease: easeOut, delay: active ? 0.06 : 0 }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function PersonalityStrip({
    items,
}: {
    items: { label: string; Icon: React.ElementType }[];
}) {
    if (!items.length) return null;
    return (
        <div className="relative">
            <div className="fade-mask-both overflow-x-auto hide-scrollbar flex gap-2 py-0.5 px-1">
                {items.map(({ label, Icon }) => (
                    <span
                        key={label}
                        className="inline-flex items-center gap-1.5 shrink-0 h-7 px-2.5 rounded-full border border-[var(--border)]/70 bg-[color-mix(in_srgb,var(--text-primary)_3%,transparent)] text-[11px] font-semibold text-[var(--text-secondary)]"
                    >
                        <Icon size={12} className="text-[var(--color-primary-400)]" />
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
}

/** Minimal RTL select */
export function AiSelect({
    value,
    onChange,
    options,
    placeholder = 'انتخاب کنید…',
    disabled,
    label,
}: {
    value: string | number | null;
    onChange: (v: string) => void;
    options: { value: string | number; label: string }[];
    placeholder?: string;
    disabled?: boolean;
    label?: string;
}) {
    return (
        <div className="relative">
            <select
                value={value == null ? '' : String(value)}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                aria-label={label}
                className="w-full appearance-none h-9 pl-8 pr-3 rounded-[10px] border border-[var(--border)]/80 bg-[color-mix(in_srgb,var(--text-primary)_3%,transparent)] text-[12px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[color-mix(in_srgb,var(--color-primary-500)_35%,var(--border))] transition-colors disabled:opacity-50 cursor-pointer"
                dir="rtl"
            >
                <option value="">{placeholder}</option>
                {options.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>
                        {o.label}
                    </option>
                ))}
            </select>
            <ChevronDown
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
        </div>
    );
}

/** Animated pill segmented tabs */
export function PillTabs<T extends string>({
    tabs,
    value,
    onChange,
    className = '',
}: {
    tabs: { id: T; label: string; icon: React.ElementType }[];
    value: T;
    onChange: (id: T) => void;
    className?: string;
}) {
    return (
        <div
            className={`relative flex p-1 rounded-[12px] bg-[color-mix(in_srgb,var(--text-primary)_4.5%,transparent)] border border-[var(--border)]/50 ${className}`}
            role="tablist"
        >
            {tabs.map((t) => {
                const Icon = t.icon;
                const active = value === t.id;
                return (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(t.id)}
                        className={`relative flex-1 z-10 flex items-center justify-center gap-1.5 py-2 px-2 text-[11px] font-bold transition-colors duration-200 ${
                            active ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                        }`}
                    >
                        {active && (
                            <motion.span
                                layoutId="ai-pill-tab"
                                className="absolute inset-0 rounded-[10px] bg-[var(--bg-card)] border border-[var(--border)]/70 shadow-[0_1px_0_rgba(255,255,255,0.04)]"
                                transition={springTab}
                            />
                        )}
                        <span className="relative z-10 inline-flex items-center gap-1.5">
                            <Icon size={13} strokeWidth={2} />
                            {t.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/** Polished RTL-safe switch — flex justify, no transform (transform breaks under dir=rtl) */
export function AiSwitch({
    checked,
    onChange,
    disabled,
    label,
}: {
    checked: boolean;
    onChange?: (v: boolean) => void;
    disabled?: boolean;
    label?: string;
}) {
    const className = `relative inline-flex w-10 h-[22px] shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ${
        checked
            ? 'bg-[var(--color-primary-500)] justify-end'
            : 'bg-[var(--border-strong)] justify-start'
    } ${disabled ? 'opacity-40' : ''}`;
    const knob = <span className="block w-[18px] h-[18px] rounded-full bg-white shadow-sm" />;

    if (!onChange) {
        return (
            <span className={`${className} pointer-events-none`} aria-hidden>
                {knob}
            </span>
        );
    }

    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={(e) => {
                e.stopPropagation();
                onChange(!checked);
            }}
            className={`${className} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-500)] disabled:opacity-40`}
        >
            {knob}
        </button>
    );
}

export function SearchField({
    value,
    onChange,
    placeholder,
    className = '',
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
}) {
    return (
        <div
            className={`group flex items-center gap-2 h-10 px-3 rounded-[12px] border border-[var(--border)]/70 bg-[color-mix(in_srgb,var(--text-primary)_3%,transparent)] focus-within:border-[color-mix(in_srgb,var(--color-primary-500)_35%,var(--border))] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary-500)_12%,transparent)] transition-all duration-200 ${className}`}
        >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-[var(--text-muted)] shrink-0" aria-hidden>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || 'جستجو…'}
                className="fflex-1
    min-w-0
    w-full
    bg-transparent
    border-0
    outline-none
    ring-0
    shadow-none
    appearance-none
    focus:border-0
    focus:outline-none
    focus:ring-0
    focus:shadow-none
    text-[13px]
    text-[var(--text-primary)]
    placeholder:text-[var(--text-muted)]"
            />
            <AnimatePresence>
                {!!value && (
                    <motion.button
                        type="button"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => onChange('')}
                        className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        aria-label="پاک کردن"
                    >
                        <X size={14} />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}

/* Back-compat exports used by onboarding screens */
export function FlatButton({
    children,
    className = '',
    type = 'button',
    ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            type={type}
            className={`inline-flex items-center justify-center gap-2 text-sm font-bold text-[var(--text-primary)] transition-opacity disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
            {...rest}
        >
            {children}
        </button>
    );
}

export function FlatPrimaryButton({
    children,
    className = '',
    type = 'button',
    ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            type={type}
            className={`inline-flex items-center justify-center gap-2 text-sm font-extrabold text-[var(--color-primary-500)] transition-opacity disabled:opacity-40 ${className}`}
            {...rest}
        >
            {children}
        </button>
    );
}

export function FadeIn({
    children,
    className = '',
    delay = 0,
}: {
    children: React.ReactNode;
    className?: string;
    delay?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay, ease: easeOut }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

export function AiScrollArea({
    children,
    className = '',
}: {
    children: React.ReactNode;
    className?: string;
    withNavClearance?: boolean;
}) {
    return (
        <HiddenScroll className={`flex-1 min-h-0 p-4 sm:p-6 lg:p-8 ${className}`}>
            {children}
        </HiddenScroll>
    );
}

export function StatusShimmer({ text, showDot }: { text: string; active?: boolean; showDot?: boolean }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            {showDot && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
            <span className="text-[11px] text-[var(--text-muted)]">{text}</span>
        </span>
    );
}

export const AI_HEADER_H = AI_HEADER_H_DESKTOP;
export function AiAtmosphere({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <AiPageShell className={className}>{children}</AiPageShell>;
}
export function FadeScroll({ children, className = '', contentClassName = '' }: { children: React.ReactNode; className?: string; contentClassName?: string; topFade?: boolean; bottomFade?: boolean }) {
    return <HiddenScroll className={`flex-1 min-h-0 ${className} ${contentClassName}`}>{children}</HiddenScroll>;
}
