import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { AiPageShell, FadeIn, FlatPrimaryButton, HiddenScroll, useIsMobile } from './ui';

type Props = {
    onStart: () => void;
    loading?: boolean;
};

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'lord-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
                src?: string;
                trigger?: string;
                colors?: string;
                style?: React.CSSProperties;
            };
        }
    }
}

function useLordIcon() {
    useEffect(() => {
        if (document.querySelector('script[data-lordicon]')) return;
        const s = document.createElement('script');
        s.src = 'https://cdn.lordicon.com/lordicon.js';
        s.dataset.lordicon = '1';
        s.async = true;
        document.body.appendChild(s);
    }, []);
}

export function IntroScreen({ onStart, loading }: Props) {
    useLordIcon();
    const isMobile = useIsMobile();

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
                            isMobile
                                ? 'max-w-sm'
                                : 'max-w-5xl grid grid-cols-2 gap-12 lg:gap-20 items-center'
                        }`}
                    >
                        <FadeIn className={`flex justify-center ${isMobile ? 'mb-8' : ''}`}>
                            <motion.div
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                                className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] lg:w-[260px] lg:h-[260px]"
                            >
                                <lord-icon
                                    src="https://cdn.lordicon.com/jpdtnwas.json"
                                    trigger="loop"
                                    colors="primary:#6366f1,secondary:#a5b4fc"
                                    style={{ width: '100%', height: '100%' }}
                                />
                            </motion.div>
                        </FadeIn>

                        <FadeIn delay={0.08} className={isMobile ? '' : 'text-right'}>
                            <p className="text-[11px] font-bold tracking-wide text-[var(--text-muted)] mb-3">
                                معلم خصوصی هوشمند
                            </p>
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[var(--text-primary)] tracking-tight leading-tight mb-4">
                                یادگیری شخصی، درست مثل یک معلم واقعی
                            </h1>
                            <p
                                className={`text-sm text-[var(--text-secondary)] leading-8 mb-8 ${
                                    isMobile ? 'max-w-xs mx-auto' : 'max-w-md'
                                }`}
                            >
                                پروفایل یادگیری بساز، معلم مناسبت را انتخاب کن و با گفتگوی متنی مفاهیم سخت را
                                گام‌به‌گام بفهم — با پشتیبانی فرمول و ریاضیات.
                            </p>

                            <FlatPrimaryButton
                                onClick={onStart}
                                disabled={loading}
                                className={`text-base py-2 ${isMobile ? '' : ''}`}
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
