import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Met, subjectToMetColor, type MetHandle, type MetState } from '../../components/met';
import type { SubjectKey } from './types';
import { SUBJECT_FALLBACKS, SubjectIcon } from './subjectIcons';
import { AiPageShell, easeOut, useIsMobile } from './ui';
import { useTypingLoop } from './useTypingLoop';

type Props = {
    onStart: () => void;
    onBack?: () => void;
    loading?: boolean;
};

type Slide = {
    key: SubjectKey;
    state: MetState;
    title: string;
    lines: string[];
};

const SLIDES: Slide[] = [
    {
        key: 'math',
        state: 'happy',
        title: 'ریاضی را با شهود بفهم',
        lines: [
            'سلام! من «مِت» هستم — همراه یادگیریت.',
            'ریاضی را قدم‌به‌قدم، با مثال و شهود یاد می‌گیریم.',
            'هر جا گیر کردی، دقیقاً همان قدم را برایت باز می‌کنم.',
        ],
    },
    {
        key: 'biology',
        state: 'curious',
        title: 'زیست، درست از روی کتاب',
        lines: [
            'زیست را با زبان کتاب درسی خودت جواب می‌دهم.',
            'عکس صفحه‌ی کتاب یا جزوه‌ات را بفرست تا با هم بخوانیم.',
            'برایت نمودار و شکل آموزشی هم می‌کشم.',
        ],
    },
    {
        key: 'physics',
        state: 'excited',
        title: 'فیزیک، اول شهود بعد فرمول',
        lines: [
            'اول می‌فهمیم چه اتفاقی می‌افتد، بعد فرمولش را می‌نویسیم.',
            'مسئله‌ها را با واحدها و راه‌حل کامل حل می‌کنیم.',
            'اشتباه‌های رایج را قبل از امتحان به تو نشان می‌دهم.',
        ],
    },
    {
        key: 'chemistry',
        state: 'focused',
        title: 'شیمی با واکنش و دلیل',
        lines: [
            'واکنش‌ها را با معادله و دلیلِ پشت آن‌ها یاد می‌گیریم.',
            'استوکیومتری را قدم‌به‌قدم با هم تمرین می‌کنیم.',
            'نمرات آزمون‌هایت را می‌بینم تا از همان‌جا شروع کنیم.',
        ],
    },
];

const AUTO_ADVANCE_MS = 6000;

export function IntroScreen({ onStart, onBack, loading }: Props) {
    const isMobile = useIsMobile();
    const metRef = useRef<MetHandle>(null);
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const slide = SLIDES[index];
    const color = SUBJECT_FALLBACKS[slide.key].color;
    const { text } = useTypingLoop(slide.lines, { holdMs: 1900 });

    // Auto-advance the slide carousel; pause while the user interacts.
    useEffect(() => {
        if (paused) return;
        const t = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), AUTO_ADVANCE_MS);
        return () => clearTimeout(t);
    }, [index, paused]);

    const go = (dir: 1 | -1) => {
        setPaused(true);
        setIndex((i) => (i + dir + SLIDES.length) % SLIDES.length);
        setTimeout(() => setPaused(false), 9000);
    };

    return (
        <AiPageShell>
            {/* Back to dashboard */}
            {onBack && (
                <div className="absolute top-0 inset-x-0 z-20" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }} dir="ltr">
                    <div className="h-12 px-3 flex items-center">
                        <button
                            type="button"
                            onClick={onBack}
                            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                            <ArrowRight size={15} className="rotate-180" />
                            بازگشت
                        </button>
                    </div>
                </div>
            )}

            <motion.div
                className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 text-center overflow-hidden"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={(_, info) => {
                    if (info.offset.x > 48) go(-1);
                    else if (info.offset.x < -48) go(1);
                }}
                style={{ touchAction: 'pan-y' }}
            >
                {/* Glow halo behind the character, tinted per subject */}
                <div className="relative flex items-center justify-center mb-2">
                    <motion.div
                        aria-hidden
                        className="absolute rounded-full blur-3xl"
                        animate={{ background: `radial-gradient(circle, ${color}55 0%, ${color}18 45%, transparent 70%)` }}
                        transition={{ duration: 0.8 }}
                        style={{
                            width: isMobile ? 300 : 420,
                            height: isMobile ? 300 : 420,
                        }}
                    />
                    <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
                        className={`relative ${isMobile ? 'w-[230px] h-[230px]' : 'w-[300px] h-[300px]'}`}
                    >
                        <Met
                            ref={metRef}
                            size="100%"
                            color={subjectToMetColor(slide.key)}
                            state={slide.state}
                            interactive
                            energy={0.65}
                        />
                    </motion.div>
                </div>

                {/* Subject badge + slide texts */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={slide.key}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.3, ease: easeOut }}
                        className="flex flex-col items-center"
                    >
                        <span
                            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-black mb-3"
                            style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
                        >
                            <SubjectIcon icon={SUBJECT_FALLBACKS[slide.key].icon} size={12} />
                            {SUBJECT_FALLBACKS[slide.key].nameFa}
                        </span>
                        <h1 className="text-xl sm:text-2xl lg:text-[1.7rem] font-black text-[var(--text-primary)] tracking-tight leading-relaxed">
                            {slide.title}
                        </h1>
                    </motion.div>
                </AnimatePresence>

                <p className="mt-3 text-[13.5px] sm:text-sm text-[var(--text-secondary)] leading-8 min-h-[4rem] max-w-md" dir="rtl">
                    {text}
                    <span className="inline-block w-[2px] h-[1em] align-[-0.15em] mr-0.5 animate-pulse" style={{ background: color }} />
                </p>

                {/* Slide dots */}
                <div className="flex items-center gap-1.5 mt-4" dir="ltr">
                    {SLIDES.map((s, i) => (
                        <button
                            key={s.key}
                            type="button"
                            aria-label={SUBJECT_FALLBACKS[s.key].nameFa}
                            onClick={() => { setPaused(true); setIndex(i); setTimeout(() => setPaused(false), 9000); }}
                            className="p-1"
                        >
                            <motion.span
                                className="block h-1.5 rounded-full"
                                animate={{
                                    width: i === index ? 18 : 6,
                                    background: i === index ? SUBJECT_FALLBACKS[s.key].color : 'var(--border-strong)',
                                }}
                                transition={{ duration: 0.25, ease: easeOut }}
                            />
                        </button>
                    ))}
                </div>

                {/* CTA */}
                <motion.button
                    type="button"
                    onClick={() => {
                        metRef.current?.poke();
                        onStart();
                    }}
                    disabled={loading}
                    whileTap={{ scale: 0.97 }}
                    className="mt-7 inline-flex items-center justify-center gap-2 h-12 px-9 rounded-full text-[14.5px] font-black text-white transition-all disabled:opacity-60"
                    animate={{
                        background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 60%, #000))`,
                        boxShadow: `0 6px 24px ${color}4d`,
                    }}
                    transition={{ duration: 0.6 }}
                >
                    {loading ? 'در حال آماده‌سازی…' : 'شروع کنیم'}
                    {!loading && <ArrowLeft size={17} />}
                </motion.button>

                <p className="mt-4 text-[10.5px] text-[var(--text-muted)]">
                    مِت — همراه یادگیری ریاضی، زیست، فیزیک و شیمی
                </p>
            </motion.div>
        </AiPageShell>
    );
}
