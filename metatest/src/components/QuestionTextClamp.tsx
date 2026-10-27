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
    /** Shown only after «ادامه متن». Short text stays fully visible beside the button. */
    images?: string[];
};

export function QuestionTextClamp({
    text,
    subject,
    resetKey,
    className = '',
    inline = false,
    images,
}: QuestionTextClampProps) {
    const contentRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [height, setHeight] = useState(0);
    const pictures = (images || []).filter(Boolean);

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
    const hasImages = pictures.length > 0;
    const expandable = overflows || hasImages;
    const collapsed = expandable && !open;

    return (
        <div className="question-text-clamp" dir="rtl">
            <div
                className={collapsed && overflows ? 'relative cursor-pointer' : undefined}
                onClick={collapsed && overflows ? () => setOpen(true) : undefined}
                onKeyDown={collapsed && overflows ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setOpen(true);
                    }
                } : undefined}
                role={collapsed && overflows ? 'button' : undefined}
                tabIndex={collapsed && overflows ? 0 : undefined}
                aria-expanded={expandable ? !collapsed : undefined}
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

                {collapsed && overflows && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-0.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-card)] px-2 py-0.5 text-[12px] font-black text-[var(--accent)]">
                            <span>ادامه متن</span>
                            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </span>
                    </div>
                )}
            </div>

            {collapsed && !overflows && hasImages && (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="mt-2 inline-flex h-8 cursor-pointer items-center gap-1 rounded-full px-2 text-[12px] font-black text-[var(--accent)]"
                >
                    <span>ادامه متن</span>
                    <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
            )}

            {open && hasImages && (
                <div className="mt-4 flex flex-col items-center gap-4">
                    {pictures.map((src, index) => (
                        <img
                            key={`${src}-${index}`}
                            src={src}
                            alt=""
                            loading="lazy"
                            className="mx-auto block h-auto w-auto max-h-52 max-w-[min(100%,28rem)] object-contain md:max-h-72 md:max-w-[min(100%,36rem)]"
                        />
                    ))}
                </div>
            )}

            {open && expandable && (
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
