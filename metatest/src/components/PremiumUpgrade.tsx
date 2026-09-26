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
        <div className={`relative text-center ${bare ? 'px-1 py-4' : 'overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] px-6 pb-10 pt-14'} ${className}`} dir="rtl">
            <div className="relative mx-auto mb-6 h-16 w-16">
                <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-10 rounded-full"
                    style={{
                        background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 10%, transparent) 0%, color-mix(in srgb, var(--accent) 28%, transparent) 34%, color-mix(in srgb, var(--accent) 12%, transparent) 52%, transparent 74%)',
                    }}
                />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--icon-bg)_82%,transparent)] text-[var(--icon-color)]">
                    <Icon size={34} strokeWidth={1.35} />
                </div>
            </div>
            <h3 className="premium-title-shimmer relative text-[1.35rem] font-black tracking-tight">{title}</h3>
            <p className="relative mx-auto mt-2 max-w-md text-sm leading-7 text-[var(--text-secondary)]">{description}</p>
            {actionLabel && onAction && (
                <button
                    type="button"
                    onClick={onAction}
                    className="relative mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[var(--accent)] px-6 text-sm font-extrabold text-white shadow-[0_10px_24px_-12px_color-mix(in_srgb,var(--accent)_75%,transparent)] transition-transform active:scale-[0.98]"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
