import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Sparkles } from 'lucide-react';
import { useTour } from '../context/TourContext';
import { subscribeToPush } from '../pwa/register';

const ASKED_KEY = 'mt-push-asked';

function markAsked() {
    try { localStorage.setItem(ASKED_KEY, '1'); } catch { /* private mode */ }
}

export function PushPrompt() {
    const { tourActive } = useTour();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const subscribed = useRef(false);

    useEffect(() => {
        if (!import.meta.env.PROD || tourActive) return;
        if (!('Notification' in window)) return;
        if (Notification.permission === 'granted') {
            if (!subscribed.current) {
                subscribed.current = true;
                subscribeToPush().catch(() => { subscribed.current = false; });
            }
            return;
        }
        if (Notification.permission !== 'default') return;
        try {
            if (localStorage.getItem(ASKED_KEY) === '1') return;
        } catch {
            return;
        }
        const timer = window.setTimeout(() => {
            markAsked();
            setOpen(true);
        }, 1400);
        return () => window.clearTimeout(timer);
    }, [tourActive]);

    const later = () => {
        markAsked();
        setOpen(false);
    };

    const allow = async () => {
        setBusy(true);
        markAsked();
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') await subscribeToPush();
        } catch {
            /* the browser prompt was dismissed */
        } finally {
            setBusy(false);
            setOpen(false);
        }
    };

    return (
        <AnimatePresence>
            {open && !tourActive && (
                <motion.div
                    className="fixed inset-0 z-[70] flex items-end justify-center p-3 md:items-center md:p-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <button type="button" aria-label="بعداً" className="absolute inset-0 bg-black/50" onClick={later} />
                    <motion.div
                        role="dialog"
                        aria-labelledby="push-prompt-title"
                        dir="rtl"
                        initial={{ y: 36, opacity: 0, scale: 0.98 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 24, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                        className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl"
                    >
                        <div className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-[var(--accent)]/20 blur-3xl" />
                        <div className="relative flex flex-col gap-4 p-5 md:p-6">
                            <div className="flex items-center gap-3">
                                <motion.div
                                    animate={{ rotate: [0, -12, 10, -6, 0] }}
                                    transition={{ duration: 1.1, delay: 0.25, ease: 'easeInOut' }}
                                    className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-white"
                                >
                                    <Bell className="h-6 w-6" />
                                </motion.div>
                                <div>
                                    <p className="flex items-center gap-1 text-[11px] font-black text-[var(--accent)]">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        یک بار، همین‌جا
                                    </p>
                                    <h2 id="push-prompt-title" className="text-lg font-black">خبرهای مهم را از دست نده</h2>
                                </div>
                            </div>
                            <p className="text-sm leading-7 text-[var(--text-secondary)]">
                                اگر اجازه بدهی، یادآوری تمرین، سطح جدید و خبرهای متاتست حتی وقتی سایت باز نیست روی دستگاهت می‌آید.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => void allow()}
                                    disabled={busy}
                                    className="flex-1 rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                                >
                                    {busy ? 'در حال ثبت...' : 'اجازه می‌دهم'}
                                </button>
                                <button
                                    type="button"
                                    onClick={later}
                                    className="rounded-2xl px-4 py-3 text-sm font-bold text-[var(--text-secondary)]"
                                >
                                    بعداً
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
