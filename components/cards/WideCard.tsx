// src/components/cards/WideCard.tsx
import { ChevronLeft, Lock, CheckCircle2 } from 'lucide-react';
import { ElementType, useEffect, useRef, useState } from 'react';

// --- Helper Component for Professional Marquee Effect ---
const MarqueeTitle = ({ label, className }: { label: string; className: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [scrollDistance, setScrollDistance] = useState(0);

    useEffect(() => {
        const checkOverflow = () => {
            if (containerRef.current && textRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                const textWidth = textRef.current.scrollWidth;

                if (textWidth > containerWidth) {
                    // Added a 20px buffer so it scrolls fully to the end
                    setScrollDistance((textWidth - containerWidth) + 20);
                } else {
                    setScrollDistance(0);
                }
            }
        };

        checkOverflow();

        const observer = new ResizeObserver(checkOverflow);
        if (containerRef.current) observer.observe(containerRef.current);

        return () => observer.disconnect();
    }, [label]);

    const isOverflowing = scrollDistance > 0;
    const scrollDuration = Math.max(3, scrollDistance / 40);
    const totalDuration = scrollDuration * 2.5;

    return (
        // Added py-1 to prevent vertical clipping and negative margin for alignment
        <div ref={containerRef} className="relative overflow-hidden whitespace-nowrap flex w-full py-1 -my-1" dir="auto">
            <style>
                {`
                @keyframes smoothMarquee {
                    0%, 15% { transform: translateX(0); }
                    40%, 60% { transform: translateX(calc(-1 * var(--scroll-dist))); }
                    85%, 100% { transform: translateX(0); }
                }
                [dir="rtl"] .animate-pro-marquee {
                    animation-name: smoothMarqueeRTL !important;
                }
                @keyframes smoothMarqueeRTL {
                    0%, 15% { transform: translateX(0); }
                    40%, 60% { transform: translateX(var(--scroll-dist)); }
                    85%, 100% { transform: translateX(0); }
                }
                `}
            </style>
            <span
                ref={textRef}
                // Added px-1 to give the start/end characters breathing room
                className={`inline-block px-1 ${className} ${isOverflowing ? 'animate-pro-marquee' : 'truncate'}`}
                style={
                    isOverflowing
                        ? {
                            '--scroll-dist': `${scrollDistance}px`,
                            animation: `smoothMarquee ${totalDuration}s ease-in-out infinite`,
                        } as React.CSSProperties
                        : {}
                }
            >
                {label}
            </span>
        </div>
    );
};
// --------------------------------------------------------

// --------------------------------------------------------

type WideCardProps = {
    icon: ElementType;
    label: string;
    desc?: string;
    delay: number;
    image?: string | null;
    locked?: boolean;
    showDesc?: boolean;
    progress?: number | null;
};

export const WideCard = ({
                             icon: Icon,
                             label,
                             desc,
                             delay,
                             image,
                             locked = false,
                             showDesc = false,
                             progress = null,
                         }: WideCardProps) => {
    const hasImage = !!image;

    const hasProgress = progress !== null && progress !== undefined;
    const safeProgress = hasProgress
        ? Math.max(0, Math.min(100, Math.round(Number(progress) || 0)))
        : 0;

    const isCompleted = safeProgress >= 100;

    return (
        <div
            className={[
                "group relative overflow-hidden flex items-center gap-4 p-5 rounded-2xl border transition-all duration-300 h-full",
                locked
                    ? "bg-[var(--bg-card)] border-[var(--border)] opacity-70 cursor-not-allowed"
                    : "bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/10 cursor-pointer"
            ].join(" ")}
            style={{ animation: `slideUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}ms backwards` }}
        >
            {hasProgress && !locked && safeProgress > 0 && (
                <div className="absolute bottom-0 right-0 left-0 h-1 bg-black/5 dark:bg-white/5 pointer-events-none">
                    <div
                        className="h-full bg-[var(--accent)]/50 transition-all duration-700 ease-out"
                        style={{
                            width: `${safeProgress}%`,
                            marginLeft: 'auto',
                        }}
                    />
                </div>
            )}

            {locked && (
                <div className="absolute top-6 left-3 z-20 flex items-center justify-center w-8 h-8 rounded-full bg-black/70 text-white">
                    <Lock size={16} />
                </div>
            )}

            <div
                className={[
                    "relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm shrink-0 overflow-hidden",
                    locked
                        ? "bg-[var(--bg-element)] text-[var(--text-muted)]"
                        : hasImage
                            ? "bg-[var(--bg-element)]"
                            : "bg-[var(--bg-element)] text-[var(--accent)] group-hover:scale-110 group-hover:bg-[var(--accent)] group-hover:text-white"
                ].join(" ")}
            >
                {hasImage ? (
                    <img
                        src={image}
                        alt={label}
                        className="w-10 h-10 object-cover"
                    />
                ) : (
                    <Icon size={28} strokeWidth={2} />
                )}
            </div>

            <div className="relative z-10 flex-1 min-w-0 flex flex-col justify-center">
                {/* Replaced standard <h3> with our new MarqueeTitle */}
                <MarqueeTitle
                    label={label}
                    className={[
                        "text-base font-bold transition-colors",
                        locked
                            ? "text-[var(--text-primary)]"
                            : "text-[var(--text-primary)] group-hover:text-[var(--accent)]"
                    ].join(" ")}
                />

                {showDesc && desc && (
                    <p className="text-sm text-[var(--text-muted)] mt-1 truncate">
                        {desc}
                    </p>
                )}
            </div>

            <div
                className={[
                    "relative z-10 shrink-0 min-w-10 flex items-center justify-center transition-all",
                    locked
                        ? "text-[var(--border)] opacity-50"
                        : "text-[var(--text-muted)] group-hover:text-[var(--accent)]"
                ].join(" ")}
            >
                {hasProgress ? (
                    isCompleted ? (
                        <CheckCircle2
                            size={24}
                            className="text-emerald-500"
                            strokeWidth={2.4}
                        />
                    ) : (
                        <span className="text-sm font-extrabold tabular-nums">
                            {safeProgress}%
                        </span>
                    )
                ) : (
                    <ChevronLeft
                        size={22}
                        className={!locked ? "group-hover:translate-x-1 transition-transform" : ""}
                    />
                )}
            </div>
        </div>
    );
};

export const WideCardSkeleton = () => {
    return (
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] animate-pulse h-24">
            <div className="w-14 h-14 rounded-2xl bg-[var(--border)] opacity-50"></div>
            <div className="flex-1 space-y-2">
                <div className="h-4 w-28 bg-[var(--border)] rounded opacity-50"></div>
                <div className="h-3 w-20 bg-[var(--border)] rounded opacity-50"></div>
            </div>
        </div>
    );
};
