//  src/components/ResponsiveModal.tsx

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ResponsiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    children: React.ReactNode;
    /** Pinned under the scrolling body. */
    footer?: React.ReactNode;
    className?: string;
    /** Desktop width. Mobile is always a full-width sheet. */
    maxWidthClass?: string;
}

const easeOut = [0.22, 1, 0.36, 1] as const;

/** Position springs. Opacity is eased separately so it never overshoots. */
const dialogSpring = {
    type: 'spring' as const,
    visualDuration: 0.46,
    bounce: 0.16,
};

const dialogExit = {
    type: 'spring' as const,
    visualDuration: 0.28,
    bounce: 0,
};

const sheetSpring = {
    type: 'spring' as const,
    visualDuration: 0.5,
    bounce: 0.11,
};

const sheetExit = {
    type: 'spring' as const,
    visualDuration: 0.34,
    bounce: 0,
};

export const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
                                                                    isOpen,
                                                                    onClose,
                                                                    title,
                                                                    children,
                                                                    footer,
                                                                    className = '',
                                                                    maxWidthClass = 'md:w-[700px] md:max-w-[90vw]',
                                                                }) => {
    const [isDesktop, setIsDesktop] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth >= 768 : false
    );
    const [reduceMotion, setReduceMotion] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth >= 768);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onMotion = () => setReduceMotion(motionQuery.matches);
        onMotion();
        motionQuery.addEventListener('change', onMotion);
        return () => {
            window.removeEventListener('resize', handleResize);
            motionQuery.removeEventListener('change', onMotion);
        };
    }, []);

    // جلوگیری از اسکرول شدن پس‌زمینه وقتی مودال باز است
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const fadeIn = reduceMotion ? { duration: 0.01 } : { duration: 0.34, ease: easeOut };
    const fadeOut = reduceMotion ? { duration: 0.01 } : { duration: 0.22, ease: [0.4, 0, 1, 1] as const };
    const instant = { duration: 0.01 };

    const panelPosition = isDesktop
        ? 'fixed left-1/2 top-1/2 z-[110] max-h-[85vh] rounded-2xl'
        : 'fixed inset-x-0 bottom-0 z-[110] w-full max-h-[90vh] rounded-t-3xl pb-safe';

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="responsive-modal-backdrop"
                    className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-[2px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: fadeIn }}
                    exit={{ opacity: 0, transition: fadeOut }}
                    onClick={onClose}
                />
            )}
            {isOpen && (
                <motion.div
                    key="responsive-modal-panel"
                    className={`pointer-events-auto flex flex-col overflow-hidden bg-[var(--bg-card)] ${panelPosition} ${maxWidthClass} ${className}`}
                    style={{
                        boxShadow: 'var(--shadow-2)',
                        willChange: 'transform',
                        transformOrigin: isDesktop ? 'center center' : 'center bottom',
                    }}
                    initial={isDesktop
                        ? { opacity: 0, scale: reduceMotion ? 1 : 0.94, x: '-50%', y: '-38%' }
                        : { y: reduceMotion ? '0%' : '108%' }}
                    animate={isDesktop
                        ? {
                            opacity: 1,
                            scale: 1,
                            x: '-50%',
                            y: '-50%',
                            transition: reduceMotion ? instant : { x: instant, y: dialogSpring, scale: dialogSpring, opacity: fadeIn },
                        }
                        : { y: '0%', transition: reduceMotion ? instant : sheetSpring }}
                    exit={isDesktop
                        ? {
                            opacity: 0,
                            scale: reduceMotion ? 1 : 0.98,
                            x: '-50%',
                            y: '-42%',
                            transition: reduceMotion ? instant : { x: instant, y: dialogExit, scale: dialogExit, opacity: fadeOut },
                        }
                        : { y: reduceMotion ? '0%' : '108%', transition: reduceMotion ? instant : sheetExit }}
                    drag={!isDesktop && !reduceMotion ? 'y' : false}
                    dragConstraints={{ top: 0, bottom: 0 }}
                    dragElastic={{ top: 0, bottom: 0.42 }}
                    dragMomentum={false}
                    dragTransition={{ bounceStiffness: 240, bounceDamping: 26, power: 0.2, timeConstant: 280 }}
                    onDragEnd={(_event, info) => {
                        const swipeDown = info.offset.y > 96 || info.velocity.y > 720;
                        if (swipeDown) onClose();
                    }}
                >
                    {!isDesktop && (
                        <div className="flex w-full cursor-grab justify-center pb-2 pt-3 active:cursor-grabbing touch-none">
                            <div className="h-1.5 w-12 rounded-full bg-[var(--border-strong)]" />
                        </div>
                    )}

                    <div className={`flex items-center justify-between border-b border-[var(--border)] px-6 py-4 ${!isDesktop ? 'pt-1' : ''}`}>
                        <div className="min-w-0 flex-1 text-lg font-bold text-[var(--text-primary)]">
                            {title}
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="بستن"
                            className="-mr-2 rounded-full p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--accent)] focus:outline-none"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 text-[var(--text-primary)] custom-scrollbar [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {children}
                    </div>
                    {footer && (
                        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-card)] px-6 py-4">
                            {footer}
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

