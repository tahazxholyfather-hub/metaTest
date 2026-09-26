import type { LucideIcon } from 'lucide-react';
import { Sparkles } from 'lucide-react';

type Props = {
    icon?: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
    /** Drop the card chrome when the prompt already sits inside a modal. */
    bare?: boolean;
};

/**
 * Soft upgrade prompt. Pass different copy per surface — practice solutions,
 * exam builder, or anywhere else a free limit is reached.
 */
export function PremiumUpgrade({
    icon: Icon = Sparkles,
    title,
    description,
    actionLabel,
    onAction,
    className = '',
    bare = false,
}: Props) {
    return (
        <div className={`relative overflow-hidden text-center ${bare ? 'px-1 py-2' : 'rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] px-6 py-10'} ${className}`} dir="rtl">
            <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 -translate-y-1/3 rounded-full bg-[var(--accent)]/25 blur-3xl"
            />
            <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--icon-bg)] text-[var(--icon-color)]">
                <Icon size={34} strokeWidth={1.35} />
            </div>
            <h3 className="premium-title-shimmer relative text-[1.35rem] font-black tracking-tight">{title}</h3>
            <p className="relative mx-auto mt-2 max-w-md text-sm leading-7 text-[var(--text-secondary)]">{description}</p>
            {actionLabel && onAction && (
                <button
                    type="button"
                    onClick={onAction}
                    className="relative mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[var(--accent)] px-6 text-sm font-extrabold text-[var(--text-inverse)] shadow-[0_10px_24px_-12px_color-mix(in_srgb,var(--accent)_75%,transparent)] transition-transform active:scale-[0.98]"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
