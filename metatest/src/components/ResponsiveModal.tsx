//  src/components/ResponsiveModal.tsx

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ResponsiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

export const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
                                                                    isOpen,
                                                                    onClose,
                                                                    title,
                                                                    children,
                                                                    className = '',
                                                                }) => {
    // بررسی سایز صفحه برای اعمال انیمیشن متفاوت در موبایل و دسکتاپ
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth >= 768);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
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

    // انیمیشن پس‌زمینه (Backdrop)
    const backdropVariants = {
        hidden: {
            opacity: 0,
            transition: { duration: 0.2, ease: "easeInOut" }
        },
        visible: {
            opacity: 1,
            transition: { duration: 0.3, ease: "easeOut" }
        },
    };

    // انیمیشن دسکتاپ
    const desktopModalVariants = {
        hidden: { opacity: 0, scale: 0.96, y: 15 },
        visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
                type: "spring",
                stiffness: 400,
                damping: 30,
                mass: 0.8
            }
        },
        exit: {
            opacity: 0,
            scale: 0.98,
            y: 5,
            transition: {
                duration: 0.2,
                ease: [0.22, 1, 0.36, 1]
            }
        },
    };

    // انیمیشن فوق‌روان و نیتیو برای موبایل (Bottom Sheet)
    const mobileSheetVariants = {
        hidden: { y: "100%" },
        visible: {
            y: 0,
            transition: {
                type: "spring",
                stiffness: 260,
                damping: 26,
                mass: 1
            }
        },
        exit: {
            y: "100%",
            transition: {
                type: "spring",
                stiffness: 260,
                damping: 26,
                mass: 1
            }
        },
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* لایه پس‌زمینه */}
                    <motion.div
                        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
                        variants={backdropVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        onClick={onClose}
                    />

                    {/* کانتینر مودال */}
                    <div className="fixed inset-0 z-[110] pointer-events-none flex items-end md:items-center justify-center p-0 md:p-4 ">
                        <motion.div
                            className={`
                                pointer-events-auto flex flex-col w-full bg-[var(--bg-card)]
                                overflow-hidden relative
                                /* استایل موبایل */
                                rounded-t-3xl max-h-[90vh] pb-safe
                                /* استایل دسکتاپ */
                                md:w-[700px] md:max-w-[90vw] md:rounded-2xl md:max-h-[85vh]
                                ${className}
                            `}
                            style={{
                                boxShadow: 'var(--shadow-2)'
                            }}
                            variants={isDesktop ? desktopModalVariants : mobileSheetVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"

                            // تنظیمات پیشرفته درگ (کشیدن) برای موبایل
                            drag={!isDesktop ? "y" : false}
                            dragConstraints={{ top: 0, bottom: 0 }}
                            // مقاومت صفر به سمت پایین (0.8) و قفل مطلق به سمت بالا (0)
                            dragElastic={{ top: 0, bottom: 0.8 }}
                            onDragEnd={(event, info) => {
                                // اگر کاربر مودال را بیش از ۱۰۰ پیکسل به پایین کشید، یا با سرعت به پایین پرتاب کرد
                                const swipeDown = info.offset.y > 100 || info.velocity.y > 400;
                                if (swipeDown) {
                                    onClose();
                                }
                            }}
                        >
                            {/* هندل کشیدن در موبایل */}
                            {!isDesktop && (
                                <div className="w-full flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none">
                                    <div className="w-12 h-1.5 bg-[var(--border-strong)] rounded-full" />
                                </div>
                            )}

                            {/* هدر */}
                            <div className={`flex items-center justify-between px-6 py-4 border-b border-[var(--border)] ${!isDesktop ? 'pt-1' : ''}`}>
                                <div className="flex-1 text-lg font-bold text-[var(--text-primary)] truncate">
                                    {title}
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 -mr-2 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors rounded-full hover:bg-[var(--hover-overlay)] focus:outline-none"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* محتوا */}
                            <div className="overflow-y-auto px-6 py-4 custom-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] text-[var(--text-primary)]">
                                {children}
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};

