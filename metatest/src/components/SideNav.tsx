// src/components/SideNav.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import {
    Home,
    BookOpen,
    User,
    Moon,
    Sun,
    LogOut,
    ClipboardCheck,
    PanelLeftClose,
    PanelRightClose,
    Crown,
    Star,
    Shield,
    Diamond,
    Files,
    History,
    Sparkles,
    Rocket,
    GraduationCap
} from 'lucide-react';
import type { View } from '../types';
import { useUser } from '../context/UserContext';
import { ThemeSwitch } from './ThemeSwitch';
import PlanSelectionModal from './PlanSelectionModal';

type SideNavProps = {
    activeView: View;
    onNavigate: (view: View) => void;
    theme: 'dark' | 'light';
    onToggleTheme: () => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onLogout: () => void;
};

// --- Plan Configuration ---
const PLAN_CONFIG: Record<string, { label: string, totalDays: number, colorClass: string, hexColor: string, icon: React.ElementType, bgLight: string }> = {
    free: { label: 'طرح رایگان', totalDays: 0, colorClass: 'text-slate-500', hexColor: '#64748b', icon: User, bgLight: 'bg-slate-500/10' },
    bronze: { label: 'برنزی', totalDays: 30, colorClass: 'text-amber-700 dark:text-amber-500', hexColor: '#d97706', icon: Star, bgLight: 'bg-amber-500/10' },
    silver: { label: 'نقره‌ای', totalDays: 90, colorClass: 'text-gray-600 dark:text-gray-400', hexColor: '#9ca3af', icon: Shield, bgLight: 'bg-gray-500/10' },
    golden: { label: 'طلایی', totalDays: 180, colorClass: 'text-yellow-500 dark:text-yellow-400', hexColor: '#eab308', icon: Crown, bgLight: 'bg-yellow-500/10' },
    diamond: { label: 'الماسی', totalDays: 365, colorClass: 'text-cyan-600 dark:text-cyan-400', hexColor: '#06b6d4', icon: Diamond, bgLight: 'bg-cyan-500/10' },
};

// --- Compact Circular Progress Component for Collapsed State ---
const CircularProgress = ({ progress, days, colorClass }: { progress: number, days: number, colorClass: string }) => {
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center w-12 h-12" title={`${days} روز باقی‌مانده`}>
            <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r={radius} stroke="currentColor" strokeWidth="2.5" fill="transparent" className="text-[var(--border)]" />
                <motion.circle
                    cx="22" cy="22" r={radius} stroke="currentColor" strokeWidth="2.5" fill="transparent"
                    strokeLinecap="round"
                    className={colorClass}
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1, ease: "easeOut" }}
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center mt-0.5">
                <span className="text-[11px] font-bold leading-none mb-0.5 text-[var(--text-primary)]">{days}</span>
                <span className="text-[7px] text-[var(--text-muted)] leading-none">روز</span>
            </div>
        </div>
    );
};

export const SideNav = ({ activeView, onNavigate, theme, onToggleTheme, isCollapsed, onLogout, onToggleCollapse }: SideNavProps) => {
    const navItems: { id: View; label: string; icon: React.ElementType; selectorClass: string }[] = [
        { id: 'dashboard', label: 'داشبورد', icon: Home, selectorClass: 'sidenav-tour-dashboard' },
        { id: 'practice', label: 'تمرین', icon: BookOpen, selectorClass: 'sidenav-tour-practice' },
        { id: 'tests', label: 'دنیای آزمون', icon: ClipboardCheck, selectorClass: 'sidenav-tour-tests' },
        { id: 'ai_teacher', label: 'معلم هوشمند', icon: GraduationCap, selectorClass: 'sidenav-tour-ai-teacher' },
        { id: 'documents', label: 'نمونه سوالات آماده', icon: Files, selectorClass: 'sidenav-tour-documents' },
        { id: 'History', label: 'سوابق آزمون‌ها', icon: History, selectorClass: 'sidenav-tour-history' },
        { id: 'profile', label: 'پروفایل کاربری', icon: User, selectorClass: 'sidenav-tour-profile' }
    ];

    const { user, handleLogout } = useUser();
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const logoSrc = theme === 'dark' ? '/logo.png' : '/logo2.png';

    // --- User Plan Logic ---
    const rawPlan = user?.current_plan === 'epic' ? 'diamond' : user?.current_plan;
    const currentPlanKey = rawPlan && PLAN_CONFIG[rawPlan] ? rawPlan : 'free';
    const planDetails = PLAN_CONFIG[currentPlanKey];

    const daysLeft = user?.days_remaining || 0;
    const totalDays = planDetails.totalDays;
    const isPro = currentPlanKey !== 'free';
    const hasDaysLeft = isPro && daysLeft > 0;
    const progressPercentage = hasDaysLeft && totalDays > 0 ? Math.min(100, Math.max(0, (daysLeft / totalDays) * 100)) : 0;

    const PlanIcon = planDetails.icon;

    // Shimmer style for premium plans
    const shimmerStyle = isPro ? {
        backgroundImage: `linear-gradient(90deg, ${planDetails.hexColor} 0%, #ffffff 50%, ${planDetails.hexColor} 100%)`,
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: 'shimmerText 3.5s linear infinite'
    } as React.CSSProperties : {};

    return (
        <aside
            className={`sidenav-tour-container hidden md:flex flex-col h-[100dvh] fixed right-0 top-0 bg-[var(--bg-card)] border-l border-[var(--border)] z-40 transition-all duration-300 ease-in-out ${
                isCollapsed ? 'w-20' : 'w-64'
            }`}
        >
            {/* Global Keyframes for Shimmer & Upgrade Button */}
            <style>{`
                @keyframes shimmerText {
                    to { background-position: 200% center; }
                }
                @keyframes buttonShimmer {
                    0% { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                }
                @keyframes freePlanGlow {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.35); }
                    50% { box-shadow: 0 0 18px 2px rgba(245, 158, 11, 0.28); }
                }
                .btn-shimmer-effect {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent);
                    transform: translateX(100%);
                    animation: buttonShimmer 3.5s infinite;
                }
                .sidenav-scroll {
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }
                .sidenav-scroll::-webkit-scrollbar {
                    display: none;
                    width: 0;
                    height: 0;
                }
            `}</style>

            {/* Header: Logo & Collapse Button */}
            <div className={`h-20 flex items-center border-b border-[var(--border)] shrink-0 transition-all duration-300 ${
                isCollapsed ? 'justify-center px-0' : 'justify-between px-4'
            }`}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={isCollapsed ? 'collapsed' : 'expanded'}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-center overflow-hidden"
                    >
                        <img
                            src={logoSrc}
                            alt="Logo"
                            className="object-contain transition-all duration-300 w-12"
                        />
                    </motion.div>
                </AnimatePresence>

                {!isCollapsed && (
                    <button
                        onClick={onToggleCollapse}
                        className="p-1.5 rounded-lg bg-[var(--hover-overlay)] text-[var(--text-muted)] hover:text-[var(--color-primary-500)] transition-colors"
                        title="بستن منو"
                    >
                        <PanelRightClose className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Floating Toggle Button (Only visible when collapsed) */}
            {isCollapsed && (
                <div className="flex justify-center py-2">
                    <button
                        onClick={onToggleCollapse}
                        className="p-2 rounded-xl bg-[var(--hover-overlay)] text-[var(--text-muted)] hover:text-[var(--color-primary-500)] transition-colors shadow-sm"
                        title="باز کردن منو"
                    >
                        <PanelLeftClose className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Navigation Links */}
            <nav className={`flex-1 py-3 px-2 flex flex-col gap-1 sidenav-scroll overflow-y-auto overflow-x-hidden ${isCollapsed ? 'items-center' : ''}`}>
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;

                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            title={isCollapsed ? item.label : undefined}
                            className={`${item.selectorClass} flex items-center rounded-xl font-medium transition-all duration-200 group relative overflow-hidden shrink-0 ${
                                isCollapsed ? 'w-11 h-11 justify-center p-0' : 'px-3.5 py-2.5 gap-3 w-full'
                            } ${
                                isActive
                                    ? 'text-[var(--text-primary)]'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]'
                            }`}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="sidenav-active-bg"
                                    className={`absolute inset-0 bg-gradient-to-r from-[var(--color-primary-500)]/10 to-transparent z-0 ${
                                        isCollapsed ? 'rounded-xl border border-[var(--color-primary-500)]/30' : 'border-r-4 border-[var(--color-primary-500)]'
                                    }`}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <Icon className={`w-[20px] h-[20px] shrink-0 z-10 transition-colors ${isActive ? 'text-[var(--color-primary-500)]' : ''}`} strokeWidth={1.85} />

                            {!isCollapsed && (
                                <span className="z-10 whitespace-nowrap text-right overflow-hidden text-[13px] transition-opacity duration-300">
                                    {item.label}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Bottom Section: Plan, Theme & Profile */}
            <div
    className={`
        p-4
        border-t border-[var(--border)]
        flex flex-col
        gap-3
        shrink-0
        ${isCollapsed ? 'items-center px-2 py-3' : ''}
    `}
>

                {/* --- User Plan Progress Section --- */}
                {isCollapsed ? (
                    <div className="flex flex-col items-center w-full pb-2 border-b border-[var(--border)]">
                        {hasDaysLeft ? (
                            <CircularProgress
                                progress={progressPercentage}
                                days={daysLeft}
                                colorClass={planDetails.colorClass}
                            />
                        ) : isPro ? (
                            <div
                                className={`p-2 rounded-xl ${planDetails.bgLight}`}
                                title={planDetails.label}
                            >
                                <PlanIcon
                                    size={19}
                                    className={planDetails.colorClass}
                                />
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsPlanModalOpen(true)}
                                className="
                    relative
                    overflow-hidden
                    group
                    w-8 h-8
                    flex items-center justify-center
                    rounded-xl
                    p-0
                    bg-violet-600
                    hover:bg-violet-500
                    text-white
                    shadow-[0_3px_14px_rgba(124,58,237,0.22)]
                    hover:shadow-[0_4px_18px_rgba(124,58,237,0.32)]
                    hover:-translate-y-0.5
                    transition-all duration-200
                "
                                title="ارتقا پلن"
                            >
                                <Rocket
                                    size={14}
                                    strokeWidth={2.2}
                                    className="relative z-10"
                                />

                                <div className="btn-shimmer-effect" />
                            </button>
                        )}
                    </div>
                ) : (
                    isPro ? (
                        <div className="bg-[var(--bg-element)] rounded-2xl p-3 border border-[var(--border)] shadow-sm flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${planDetails.bgLight}`}>
                                    <PlanIcon size={14} className={planDetails.colorClass} />
                                    <span className="text-xs font-bold" style={shimmerStyle}>
                                        {planDetails.label}
                                    </span>
                                </div>
                                {hasDaysLeft && (
                                    <span className="text-[10px] font-bold text-[var(--text-muted)] bg-[var(--bg-app)] px-2 py-1 rounded-md border border-[var(--border)]">
                                        {daysLeft} روز
                                    </span>
                                )}
                            </div>

                            {hasDaysLeft && (
                                <div className="h-1.5 w-full bg-[var(--hover-overlay)] rounded-full overflow-hidden border border-[var(--border)]/50">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progressPercentage}%` }}
                                        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                                        className="h-full rounded-full"
                                        style={{ backgroundColor: planDetails.hexColor }}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 p-3.5 bg-[var(--bg-element)]">
                            <div className="pointer-events-none absolute -top-8 -left-6 w-24 h-24 rounded-full bg-violet-500/10 blur-3xl" />
                            <div className="pointer-events-none absolute -bottom-10 -right-6 w-28 h-28 rounded-full bg-violet-600/8 blur-3xl" />

                            <div className="relative z-10 flex flex-col gap-3">
                                <div className="flex items-start gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-400/15 text-violet-400 flex items-center justify-center shrink-0">
                                        <Sparkles size={16} />
                                    </div>

                                    <div className="min-w-0">
                                        <div className="text-[11px] font-extrabold text-[var(--text-primary)] leading-tight">
                                            طرح رایگان
                                        </div>

                                        <p className="text-[9.5px] text-[var(--text-muted)] mt-0.5 leading-snug">
                                            امکانات محدود — با ارتقا، امکانات بیشتری در دسترس شماست.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setIsPlanModalOpen(true)}
                                    className="relative overflow-hidden group w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white shadow-[0_4px_20px_rgba(124,58,237,0.18)] hover:shadow-[0_6px_24px_rgba(124,58,237,0.28)] hover:-translate-y-0.5 transition-all duration-200"
                                >
                                    <Rocket size={14} className="relative z-10" />

                                    <span className="relative z-10 text-xs font-extrabold tracking-wide">
                ارتقا پلن
            </span>

                                    <div className="btn-shimmer-effect" />
                                </button>
                            </div>
                        </div>
                    )
                )}

                {/* --- Theme Toggle --- */}
                {isCollapsed ? (
                    <button
                        onClick={onToggleTheme}
                        className="p-2.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-colors"
                        title={theme === 'dark' ? 'تغییر به تم روشن' : 'تغییر به تم تاریک'}
                    >
                        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                ) : (
                    <div className="flex items-center justify-between px-2 py-1">
                        <span className="text-sm font-medium text-[var(--text-muted)]">حالت شب  </span>
                        <ThemeSwitch theme={theme} onToggle={onToggleTheme} />
                    </div>
                )}


                {/* --- Profile & Logout Section --- */}
                {isCollapsed ? (
                    <div className="flex flex-col items-center gap-2 mt-0.5">
                        <div className="relative shrink-0">
                            <img
                                src={user?.avatar_url ? `${user.avatar_url}` : "/avatars/user_default.png"}
                                alt="User Avatar"
                                className="w-10 h-10 rounded-full object-cover border border-[var(--border)] bg-[var(--bg-app)]"
                            />
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[var(--bg-primary)] rounded-full"></span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2.5 rounded-xl text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title="خروج از حساب"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between p-2 rounded-2xl hover:bg-[var(--hover-overlay)] transition-colors group cursor-pointer mt-1 border border-transparent hover:border-[var(--border)]">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="relative shrink-0">
                                <img
                                    src={user?.avatar_url ? `${user.avatar_url}` : "/avatars/user_default.png"}
                                    alt="User Avatar"
                                    className="w-10 h-10 rounded-full object-cover border border-[var(--border)] bg-[var(--bg-app)]"
                                />
                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[var(--bg-primary)] group-hover:border-[var(--hover-overlay)] transition-colors rounded-full"></span>
                            </div>
                            <div className="flex flex-col truncate">
                                <span className="text-sm font-bold text-[var(--text-primary)] truncate">
                                    {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : 'کاربر مهمان'}
                                </span>
                                <span className="text-xs font-medium text-[var(--text-muted)] truncate mt-0.5">
                                    {user?.phone || ''}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={onLogout}
                            className="p-2 shrink-0 rounded-xl text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title="خروج از حساب"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                )}
                <PlanSelectionModal
                    isOpen={isPlanModalOpen}
                    onClose={() => setIsPlanModalOpen(false)}
                />
            </div>
        </aside>
    );
};