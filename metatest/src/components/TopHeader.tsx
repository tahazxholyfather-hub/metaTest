// src/components/TopHeader.tsx
import React, { useRef, useState, useEffect } from "react";
import { Menu, Bell, Check, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CoinBadge } from "./CoinBadge";
import { XpBadge } from "./XpBadge";
import { MobileMenu } from "./MobileMenu";
import { useUser } from '../context/UserContext';
import { flowApi } from "../lib/authApi";

type TopHeaderProps = {
    title: string;
    step?: number;
    maxSteps?: number;
    showBackButton: boolean;
    onBack: () => void;
    activeView: string;
    onNavigate: (view: string) => void;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
    coinCount: number;
    level: number;
    currentXp: number;
    onLogout: () => void;
};

// ─── Sub-component: Live Notification Bell with Real Database Sync ───
const NotificationBell = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);

    useEffect(() => {
        const fetchHeaderMessages = async () => {
            try {
                const res = await flowApi.getDashboardData();
                if (res.success && res.data?.messages) {
                    setNotifications(res.data.messages);
                }
            } catch (error) {
                console.error("Failed to sync header messages:", error);
            }
        };

        fetchHeaderMessages();

        // Dynamic message polling fallback (every 30 seconds)
        const interval = setInterval(fetchHeaderMessages, 30000);
        return () => clearInterval(interval);
    }, []);

    const hasUnread = notifications.some(n => n.isRead === 0);

    const markAllAsRead = () => {
        setNotifications(notifications.map(n => ({ ...n, isRead: 1 })));
        // Optional: Trigger a background api request to mark notifications as read if built in later
    };

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="اعلان‌ها"
                className="relative p-2 rounded-full hover:bg-[var(--hover-overlay)] transition-colors text-[var(--text-primary)] z-50"
            >
                <Bell size={20} />
                {hasUnread && (
                    <span
                        aria-hidden="true"
                        className="absolute top-1.5 right-1.5 inline-block w-2.5 h-2.5 rounded-full bg-[#FF4D6D] border-2 border-[var(--bg-card)]"
                    />
                )}
            </button>

            {/* Click-away Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Dropdown Container */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="absolute left-[-40px] sm:left-0 top-full mt-3 w-[85vw] sm:w-[350px] max-w-[350px] bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col text-right"
                        dir="rtl"
                    >
                        {/* Dropdown Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card-secondary)]">
                            <span className="font-bold text-[var(--text-primary)] text-sm">اعلان‌های سیستم</span>
                            {hasUnread && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs flex items-center gap-1 text-[var(--color-primary-500)] hover:text-[var(--color-primary-600)] transition-colors"
                                >
                                    <Check size={14} />
                                    <span>خواندن همه</span>
                                </button>
                            )}
                        </div>

                        {/* Dropdown List with hidden scroll handling */}
                        <div className="max-h-[50vh] sm:max-h-[400px] overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            {notifications.length > 0 ? (
                                <div className="flex flex-col">
                                    {notifications.map((notif) => (
                                        <div
                                            key={`notif-item-${notif.id}`}
                                            className={`p-4 border-b last:border-b-0 border-[var(--border)] hover:bg-[var(--hover-overlay)] transition-colors cursor-pointer flex gap-3 ${notif.isRead === 0 ? 'bg-[var(--color-primary-500)]/5' : ''}`}
                                        >
                                            <div className={`mt-1 flex-shrink-0 ${notif.isRead === 0 ? 'text-[#FF4D6D]' : 'text-[var(--text-muted)]'}`}>
                                                <CheckCircle2 size={18} />
                                            </div>
                                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                <h4 className={`text-sm font-bold truncate ${notif.isRead === 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                                    {notif.title}
                                                </h4>
                                                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                                                    {notif.body || notif.message}
                                                </p>
                                                <span className="text-[10px] text-[var(--text-muted)] mt-1">
                                                    {notif.date || 'نامشخص'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                                    <Bell size={32} opacity={0.2} />
                                    <p className="text-sm">هیچ اعلان جدیدی ندارید</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const TopHeader: React.FC<TopHeaderProps> = ({
                                                        title,
                                                        step,
                                                        maxSteps,
                                                        showBackButton,
                                                        onBack,
                                                        activeView,
                                                        onNavigate,
                                                        theme,
                                                        onToggleTheme,
                                                        coinCount,
                                                        level,
                                                        currentXp,
                                                        onLogout,
                                                    }) => {
    const showProgressBar = !!(step && maxSteps && step > 0 && maxSteps > 0);
    const progressPct = showProgressBar
        ? Math.max(0, Math.min(100, (step! / maxSteps!) * 100))
        : 0;
    const { user } = useUser();
    const scoreTagRef = useRef<HTMLDivElement>(null);
    const headerHeight = "5rem";
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <>
            <MobileMenu
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                activeView={activeView}
                onNavigate={onNavigate}
                theme={theme}
                onToggleTheme={onToggleTheme}
                onLogout={onLogout}
            />

            <header
                className="fixed top-0 left-0 right-0 z-30 header-mask md:right-64"
                style={{
                    position: "sticky",
                    top: 0,
                    left: 0,
                    right: 0,
                    paddingTop: "env(safe-area-inset-top, 0px)",
                    height: headerHeight,
                }}
                aria-label="سربرگ"
            >
                <div className="h-full w-full px-5 sm:px-6">
                    {/* Desktop layout */}
                    <div className="hidden md:flex h-full items-center justify-between">
                        {/* Right: title only */}
                        <div className="min-w-0 text-right">
                            <AnimatePresence mode="wait">
                                <motion.h1
                                    key={title}
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 6 }}
                                    transition={{ duration: 0.28 }}
                                    className="text-lg font-extrabold truncate text-[var(--text-primary)]"
                                >
                                    {title}
                                </motion.h1>
                            </AnimatePresence>
                            {showProgressBar && (
                                <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5">
                                    مرحله {step} از {maxSteps}
                                </p>
                            )}
                        </div>

                        {/* Left: XP counter + coin counter + bell dropdown */}
                        <div className="header-tour-badges flex items-center gap-3">
                            <div aria-label={`سطح ${level}`} role="status">
                                <XpBadge level={level} currentXp={currentXp} />
                            </div>

                            <div aria-label={`سکه‌ها ${coinCount}`} role="status">
                                <CoinBadge count={coinCount} />
                            </div>

                            <div className="header-tour-bell">
                                <NotificationBell />
                            </div>
                        </div>
                    </div>

                    {/* Mobile layout */}
                    <div className="md:hidden h-full flex items-center justify-between">
                        {/* Left: avatar then ONLY coin counter */}
                        <div className="flex items-center gap-3">
                            <img
                                src={user?.avatar_url ? `${user.avatar_url}` : "/avatars/user_default.png"}
                                alt="آواتار"
                                className="w-10 h-10 rounded-full border-2 border-[var(--border)] object-cover"
                            />
                            <div ref={scoreTagRef} className="header-tour-coins-mobile" aria-label={`سکه‌ها ${coinCount}`} role="status">
                                <CoinBadge count={coinCount} />
                            </div>
                        </div>

                        {/* Right: bell dropdown + menu */}
                        <div className="flex items-center gap-2">
                            <NotificationBell />

                            <div className="header-tour-menu-btn">
                                <button
                                    onClick={() => setIsMenuOpen(true)}
                                    className="p-2 text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] rounded-full transition-colors"
                                >
                                    <Menu size={22} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* App Progress bar (Steps) */}
                    {showProgressBar && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px]">
                            <motion.div
                                className="h-full bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-secondary-500)]"
                                initial={{ width: "0%" }}
                                animate={{ width: `${progressPct}%` }}
                                transition={{ type: "spring", stiffness: 220, damping: 28 }}
                            />
                        </div>
                    )}
                </div>
            </header>
        </>
    );
};