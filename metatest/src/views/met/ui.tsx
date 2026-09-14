/* eslint-disable react-refresh/only-export-components -- shared UI primitives + helpers */
/* Shared UI primitives for the Met (AI tutor) screens — dark, minimal, glass. */
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Coins, X } from 'lucide-react';

export const easeOut = [0.22, 1, 0.36, 1] as const;
export const springSoft = { type: 'spring' as const, stiffness: 420, damping: 34 };
export const springPanel = { type: 'spring' as const, stiffness: 380, damping: 36, mass: 0.9 };
/** Practice Met drawer — slower, less bounce than the rail panels. */
export const springDrawer = { type: 'spring' as const, stiffness: 240, damping: 32, mass: 0.92 };
export const easeDrawer = { duration: 0.42, ease: easeOut } as const;

export const WORKING_STATUS: Record<string, string> = {
    sending: 'در حال ارسال',
    thinking: 'در حال فکر کردن',
    processing: 'در حال بررسی منابع',
    generating: 'در حال نوشتن',
};

export function workingStatusText(status?: string | null, toolLabel?: string | null) {
    if (toolLabel) return toolLabel;
    return WORKING_STATUS[status || ''] || 'در حال نوشتن';
}

export function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < breakpoint : true));
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

export const faNum = (n: number | string | null | undefined) => Number(n || 0).toLocaleString('fa-IR');

export function formatTime(iso?: string) {
    try {
        return new Date(iso || Date.now()).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

export function formatRelativeDay(iso?: string | null) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return formatTime(iso);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'دیروز';
    try {
        return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}

/* ─── Surfaces ─────────────────────────────────────────────────────────────── */

export const glassClass =
    'bg-[color-mix(in_srgb,var(--bg-card)_78%,transparent)] backdrop-blur-xl border border-[var(--border)]/70 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.55)]';

export function GlassCard({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={`rounded-[20px] ${glassClass} ${className}`} {...rest}>
            {children}
        </div>
    );
}

/** Sequential three-dot typing indicator — shown until the first streamed token. */
export function TypingDots({ className = '', label = 'در حال نوشتن' }: { className?: string; label?: string }) {
    const reduce = useReducedMotion();
    return (
        <span className={`inline-flex items-center gap-1.5 ${className}`} role="status" aria-label={label}>
            {[0, 1, 2].map((i) => (
                <motion.span
                    key={i}
                    className="block w-1.5 h-1.5 rounded-full bg-[var(--color-primary-400)]"
                    animate={reduce ? { opacity: 0.55 } : { y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
                    transition={reduce ? { duration: 0 } : { duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay: i * 0.16 }}
                />
            ))}
        </span>
    );
}

export function GraySpinner({ size = 20, className = '' }: { size?: number; className?: string }) {
    return (
        <span
            className={`inline-block animate-spin rounded-full border-2 border-[var(--text-muted)]/25 border-t-[var(--text-muted)] ${className}`}
            style={{ width: size, height: size }}
            role="status"
            aria-label="در حال بارگذاری"
        />
    );
}

export function IconButton({
    children,
    label,
    active = false,
    tone = 'neutral',
    size = 36,
    className = '',
    ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    active?: boolean;
    tone?: 'neutral' | 'primary' | 'danger';
    size?: number;
}) {
    const toneClass =
        tone === 'danger'
            ? 'text-rose-400 hover:bg-rose-500/10'
            : tone === 'primary'
              ? 'text-[var(--color-primary-400)] hover:bg-[var(--color-primary-500)]/12'
              : active
                ? 'text-[var(--text-primary)] bg-[var(--hover-overlay)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]';
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            className={`inline-flex items-center justify-center rounded-[12px] transition-colors duration-150 active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${toneClass} ${className}`}
            style={{ width: size, height: size }}
            {...rest}
        >
            {children}
        </button>
    );
}

/** Coin balance chip — the only place the number gets a subtle pop animation. */
export function CoinChip({
    total,
    onClick,
    compact = false,
    className = '',
}: {
    total: number;
    onClick?: () => void;
    compact?: boolean;
    className?: string;
}) {
    const low = total <= 0;
    const shared = {
        className: `inline-flex items-center gap-1.5 h-8 ${compact ? 'px-2' : 'px-2.5'} rounded-full border border-[var(--border)]/80 bg-[color-mix(in_srgb,var(--bg-card)_70%,transparent)] ${
            onClick ? 'hover:border-[var(--color-primary-500)]/40 transition-colors' : ''
        } ${className}`,
        'aria-label': `سکه: ${faNum(total)}`,
        title: 'سکه‌های مِت',
        dir: 'ltr' as const,
    };
    const inner = (
        <>
            <Coins size={14} className={low ? 'text-rose-400' : 'text-amber-400'} strokeWidth={2.2} />
            <motion.span
                key={total}
                initial={{ opacity: 0.4, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: easeOut }}
                className={`text-[12.5px] font-bold tabular-nums tracking-tight ${low ? 'text-rose-400' : 'text-[var(--text-primary)]'}`}
            >
                {faNum(total)}
            </motion.span>
        </>
    );
    return onClick ? (
        <button type="button" onClick={onClick} {...shared}>
            {inner}
        </button>
    ) : (
        <div {...shared}>{inner}</div>
    );
}

/* ─── Controls ─────────────────────────────────────────────────────────────── */

export function AiSwitch({
    checked,
    onChange,
    disabled,
    label,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
    label?: string;
}) {
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
            className={`relative inline-flex w-10 h-[22px] shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ${
                checked ? 'bg-[var(--color-primary-500)] justify-end' : 'bg-[var(--border-strong)] justify-start'
            } disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-500)]`}
        >
            <span className="block w-[18px] h-[18px] rounded-full bg-white shadow-sm" />
        </button>
    );
}

export function Segmented<T extends string>({
    options,
    value,
    onChange,
    disabled,
    className = '',
}: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (v: T) => void;
    disabled?: boolean;
    className?: string;
}) {
    return (
        <div
            className={`flex p-1 rounded-[12px] bg-[color-mix(in_srgb,var(--text-primary)_4.5%,transparent)] border border-[var(--border)]/50 ${className}`}
            role="radiogroup"
        >
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={disabled}
                        onClick={() => onChange(o.value)}
                        className={`relative flex-1 py-1.5 px-2 text-[11.5px] font-bold rounded-[9px] transition-colors ${
                            active ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                        } disabled:opacity-50`}
                    >
                        {active && (
                            <motion.span
                                layoutId={`seg-${options.map((x) => x.value).join('-')}`}
                                className="absolute inset-0 rounded-[9px] bg-[var(--bg-card)] border border-[var(--border)]/70"
                                transition={springSoft}
                            />
                        )}
                        <span className="relative z-10">{o.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

export function SearchField({
    value,
    onChange,
    placeholder,
    className = '',
    autoFocus,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
}) {
    return (
        <div
            className={`flex items-center gap-2 h-10 px-3 rounded-[12px] border border-[var(--border)]/70 bg-[color-mix(in_srgb,var(--text-primary)_3%,transparent)] focus-within:border-[color-mix(in_srgb,var(--color-primary-500)_35%,var(--border))] transition-colors ${className}`}
        >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-[var(--text-muted)] shrink-0" aria-hidden>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
                value={value}
                autoFocus={autoFocus}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || 'جستجو…'}
                className="flex-1 min-w-0 bg-transparent border-0 outline-none ring-0 shadow-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-0"
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

export function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <div className={`text-[10.5px] font-extrabold tracking-wide text-[var(--text-muted)] uppercase ${className}`}>{children}</div>;
}

export function EmptyHint({ icon, title, body }: { icon?: React.ReactNode; title: string; body?: string }) {
    return (
        <div className="flex flex-col items-center justify-center text-center gap-2 py-10 px-4">
            {icon && <div className="text-[var(--text-muted)]">{icon}</div>}
            <div className="text-[13px] font-bold text-[var(--text-secondary)]">{title}</div>
            {body && <p className="text-[12px] text-[var(--text-muted)] leading-relaxed max-w-[26ch] m-0">{body}</p>}
        </div>
    );
}

/** Slow text shimmer while the AI is working. */
export function WorkingText({ text, className = '' }: { text: string; className?: string }) {
    const reduce = usePrefersReducedMotion();
    return (
        <motion.span
            key={text}
            initial={{ opacity: 0, y: 1 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -1 }}
            transition={{ duration: 0.22, ease: easeOut }}
            className={`text-[11px] truncate ${reduce ? 'text-[var(--text-muted)]' : 'ai-text-shimmer'} ${className}`}
        >
            {text}
        </motion.span>
    );
}

export function useCountdown(targetIso?: string | null, enabled = true) {
    const [left, setLeft] = useState('');
    useEffect(() => {
        if (!targetIso || !enabled) return;
        const tick = () => {
            const ms = new Date(targetIso).getTime() - Date.now();
            if (ms <= 0) return setLeft('۰۰:۰۰:۰۰');
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            const s = Math.floor((ms % 60000) / 1000);
            const pad = (n: number) => String(n).padStart(2, '0');
            setLeft(`${pad(h)}:${pad(m)}:${pad(s)}`.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [targetIso, enabled]);
    return left;
}
