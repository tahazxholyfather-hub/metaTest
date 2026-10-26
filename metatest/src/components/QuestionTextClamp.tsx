import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MathRenderer } from './ui/MathRenderer';

const COLLAPSED_PX = 120;

type QuestionTextClampProps = {
    text: string;
    subject?: number | string;
    resetKey?: string | number;
    className?: string;
    inline?: boolean;
};

export function QuestionTextClamp({
    text,
    subject,
    resetKey,
    className = '',
    inline = false,
}: QuestionTextClampProps) {
    const bodyRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [overflows, setOverflows] = useState(false);
    const [fullHeight, setFullHeight] = useState(0);

    useEffect(() => {
        setOpen(false);
    }, [resetKey, text]);

    useEffect(() => {
        const el = bodyRef.current;
        if (!el) return;

        const measure = () => {
            const previous = el.style.maxHeight;
            el.style.maxHeight = 'none';
            const next = el.scrollHeight;
            el.style.maxHeight = previous;
            setFullHeight(next);
            setOverflows(next > COLLAPSED_PX + 6);
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [text, resetKey]);

    const collapsed = overflows && !open;
    const maxHeight = collapsed ? COLLAPSED_PX : Math.max(fullHeight, COLLAPSED_PX);

    return (
        <div className="question-text-clamp" dir="rtl">
            <div
                className={`relative rounded-2xl ${collapsed ? 'cursor-pointer' : ''}`}
                onClick={collapsed ? () => setOpen(true) : undefined}
                onKeyDown={collapsed ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setOpen(true);
                    }
                } : undefined}
                role={collapsed ? 'button' : undefined}
                tabIndex={collapsed ? 0 : undefined}
                aria-expanded={!collapsed}
            >
                <div
                    ref={bodyRef}
                    className={`overflow-hidden transition-[max-height] duration-300 ease-out motion-reduce:transition-none ${className}`}
                    style={{
                        maxHeight,
                        minHeight: COLLAPSED_PX,
                        WebkitMaskImage: collapsed
                            ? 'linear-gradient(to bottom, #000 0%, #000 58%, transparent 100%)'
                            : undefined,
                        maskImage: collapsed
                            ? 'linear-gradient(to bottom, #000 0%, #000 58%, transparent 100%)'
                            : undefined,
                    }}
                >
                    <MathRenderer text={text} subject={subject} inline={inline} />
                </div>

                {collapsed && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-1 flex items-end justify-center">
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1 text-[12px] font-black text-[var(--accent)] shadow-sm">
                            <span>ادامه متن</span>
                            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </span>
                    </div>
                )}
            </div>

            {open && overflows && (
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="mt-2 inline-flex h-8 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2.5 text-[12px] font-black text-[var(--accent)]"
                >
                    <span>بستن</span>
                    <ChevronUp className="h-4 w-4" strokeWidth={2.5} />
                </button>
            )}
        </div>
    );
}
