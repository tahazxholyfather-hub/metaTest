import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Met, type MetHandle } from '../../components/met';
import { AiPageShell, FadeIn, FlatPrimaryButton, HiddenScroll, useIsMobile } from './ui';
import { useTypingLoop } from './useTypingLoop';

type Props = {
    onStart: () => void;
    loading?: boolean;
};

const INTRO_LINES = [
    'سلام، من Met ام — همراه یادگیریت.',
    'ریاضی، زیست، فیزیک یا شیمی رو انتخاب کن تا شروع کنیم.',
    'می‌تونم عکس صفحه‌ی کتابت رو بخونم و برات نمودار هم بکشم.',
    'هر سوالی داری بپرس؛ از پایه‌ای‌ترین تا سطح کنکور.',
    'یادم می‌مونه کجاها گیر می‌کنی تا دقیق‌تر کمکت کنم.',
];

export function IntroScreen({ onStart, loading }: Props) {
    const isMobile = useIsMobile();
    const metRef = useRef<MetHandle>(null);
    const { text } = useTypingLoop(INTRO_LINES, { holdMs: 2000 });

    return (
        <AiPageShell>
            <HiddenScroll className="flex-1 min-h-0">
                <div
                    className={`min-h-full flex ${
                        isMobile
                            ? 'flex-col items-center justify-center px-6 py-10 text-center'
                            : 'items-center justify-center px-10 lg:px-16 py-12'
                    }`}
                >
                    <div
                        className={`w-full ${
                            isMobile ? 'max-w-sm' : 'max-w-5xl grid grid-cols-2 gap-12 lg:gap-20 items-center'
                        }`}
                    >
                        <FadeIn className={`flex justify-center ${isMobile ? 'mb-8' : ''}`}>
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                                className="w-[190px] h-[190px] sm:w-[230px] sm:h-[230px] lg:w-[280px] lg:h-[280px]"
                            >
                                <Met ref={metRef} size="100%" initialState="idle" mood="happy" energy={0.6} />
                            </motion.div>
                        </FadeIn>

                        <FadeIn delay={0.08} className={isMobile ? '' : 'text-right'}>
                            <p className="text-[11px] font-bold tracking-wide text-[var(--text-muted)] mb-3">
                                Met · همراه یادگیری هوشمند
                            </p>
                            <h1
                                className={`text-xl sm:text-2xl lg:text-3xl font-black text-[var(--text-primary)] tracking-tight leading-relaxed mb-4 min-h-[4.5em] sm:min-h-[3.6em] ${
                                    isMobile ? 'mx-auto max-w-xs' : 'max-w-md'
                                }`}
                            >
                                {text}
                                <span className="inline-block w-[2px] h-[1em] align-[-0.15em] mr-0.5 bg-[var(--color-primary-400)] animate-pulse" />
                            </h1>
                            <p
                                className={`text-sm text-[var(--text-secondary)] leading-8 mb-8 ${
                                    isMobile ? 'max-w-xs mx-auto' : 'max-w-md'
                                }`}
                            >
                                یک موضوع را انتخاب کن — ریاضی، زیست‌شناسی، فیزیک یا شیمی — و مستقیم شروع به گفتگو کن.
                            </p>

                            <FlatPrimaryButton
                                onClick={() => {
                                    metRef.current?.poke();
                                    onStart();
                                }}
                                disabled={loading}
                                className="text-base py-2"
                            >
                                {loading ? 'در حال آماده‌سازی…' : 'شروع کنیم'}
                                {!loading && <ArrowLeft size={16} />}
                            </FlatPrimaryButton>
                        </FadeIn>
                    </div>
                </div>
            </HiddenScroll>
        </AiPageShell>
    );
}
