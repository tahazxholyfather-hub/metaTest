import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MathRenderer } from './ui/MathRenderer';

/** About four lines of the quiz type size. Short questions stay at their natural height. */
const LIMIT_PX = 96;

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
    const contentRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [height, setHeight] = useState(0);

    useLayoutEffect(() => {
        setOpen(false);
    }, [resetKey, text]);

    useLayoutEffect(() => {
        const el = contentRef.current;
        if (!el) return;

        const measure = () => {
            const next = Math.ceil(el.scrollHeight);
            setHeight((current) => (current === next ? current : next));
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [text, resetKey]);

    const overflows = height > LIMIT_PX + 8;
    const collapsed = overflows && !open;

    return (
        <div className="question-text-clamp" dir="rtl">
            <div
                className={collapsed ? 'relative cursor-pointer' : undefined}
                onClick={collapsed ? () => setOpen(true) : undefined}
                onKeyDown={collapsed ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setOpen(true);
                    }
                } : undefined}
                role={collapsed ? 'button' : undefined}
                tabIndex={collapsed ? 0 : undefined}
                aria-expanded={overflows ? !collapsed : undefined}
            >
                <div
                    className={`overflow-hidden ${overflows ? 'transition-[max-height] duration-300 ease-out motion-reduce:transition-none' : ''}`}
                    style={overflows ? {
                        maxHeight: collapsed ? LIMIT_PX : height,
                        WebkitMaskImage: collapsed
                            ? 'linear-gradient(to bottom, #000 62%, transparent 100%)'
                            : undefined,
                        maskImage: collapsed
                            ? 'linear-gradient(to bottom, #000 62%, transparent 100%)'
                            : undefined,
                    } : undefined}
                >
                    <div ref={contentRef} className={className}>
                        <MathRenderer text={text} subject={subject} inline={inline} />
                    </div>
                </div>

                {collapsed && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-0.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-card)] px-2 py-0.5 text-[12px] font-black text-[var(--accent)]">
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
                    className="mt-1.5 inline-flex h-8 cursor-pointer items-center gap-1 rounded-full px-2 text-[12px] font-black text-[var(--accent)]"
                >
                    <span>بستن</span>
                    <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
            )}
        </div>
    );
}
