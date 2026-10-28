import React, {useState} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Home, BookOpen, FileText, User, LogOut, ChevronLeft,
    Trophy, Crown, Star, Shield, Diamond, Files
} from 'lucide-react';
import { ThemeSwitch } from './ThemeSwitch';
import { useUser } from '../context/UserContext';
import PlanSelectionModal from "./PlanSelectionModal";
import { PlanStatusCard } from './plan/PlanMarks';
import { MetNavIcon } from './met';

type MobileMenuProps = {
    isOpen: boolean;
    onClose: () => void;
    activeView: string;
    onNavigate: (view: string) => void;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
    onLogout: () => void;
};

const menuItems: { id: string; label: string; icon: React.ElementType | null }[] = [
    { id: 'dashboard', label: 'داشبورد', icon: Home },
    { id: 'practice', label: 'تمرین', icon: BookOpen },
    { id: 'tests', label: 'آزمون‌ها', icon: FileText },
    // Met (the AI) is represented by its own face, not a generic glyph.
    { id: 'met', label: 'مِت', icon: null },
    { id: 'documents', label: 'نمونه سوالات آماده', icon: Files },
    { id: 'profile', label: 'پروفایل', icon: User },
];

const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
};

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

// --- Updated Plan Configuration ---
const PLAN_CONFIG: Record<string, { label: string, totalDays: number, colorClass: string, hexColor: string, icon: React.ElementType, bgLight: string }> = {
    free: { label: 'طرح رایگان', totalDays: 0, colorClass: 'text-slate-500', hexColor: '#64748b', icon: User, bgLight: 'bg-slate-500/10' },
    bronze: { label: 'برنزی', totalDays: 30, colorClass: 'text-amber-700 dark:text-amber-500', hexColor: '#d97706', icon: Star, bgLight: 'bg-amber-500/10' },
    silver: { label: 'نقره‌ای', totalDays: 90, colorClass: 'text-gray-600 dark:text-gray-400', hexColor: '#9ca3af', icon: Shield, bgLight: 'bg-gray-500/10' },
    golden: { label: 'طلایی', totalDays: 180, colorClass: 'text-yellow-500 dark:text-yellow-400', hexColor: '#eab308', icon: Crown, bgLight: 'bg-yellow-500/10' },
    diamond: { label: 'الماسی', totalDays: 365, colorClass: 'text-cyan-600 dark:text-cyan-400', hexColor: '#06b6d4', icon: Diamond, bgLight: 'bg-cyan-500/10' },
};

export const MobileMenu: React.FC<MobileMenuProps> = ({
                                                          isOpen, onClose, activeView, onNavigate, theme, onToggleTheme, onLogout
                                                      }) => {
    const { user } = useUser();

    // Data Mapping
    const fullName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : 'کاربر مهمان';

    // Map old 'epic' to 'diamond' just in case old data exists, otherwise use current plan
    const rawPlan = user?.current_plan === 'epic' ? 'diamond' : user?.current_plan === 'gold' ? 'golden' : user?.current_plan;
    const knownPlan = rawPlan && PLAN_CONFIG[rawPlan] ? PLAN_CONFIG[rawPlan] : null;
    const currentPlanKey = knownPlan ? String(rawPlan) : (rawPlan && rawPlan !== 'free' ? String(rawPlan) : 'free');
    const planDetails = knownPlan || (currentPlanKey !== 'free' ? {
        label: user?.plan_name || 'اشتراک ویژه',
        totalDays: 30,
        colorClass: 'text-violet-500',
        hexColor: '#8b5cf6',
        icon: Crown,
        bgLight: 'bg-violet-500/10',
    } : PLAN_CONFIG.free);

    // Pro Plan Logic
    const daysLeft = user?.days_remaining || 0;
    const totalDays = user?.plan_days || planDetails.totalDays;
    const isPro = currentPlanKey !== 'free';
    const unlimited = Boolean(user?.plan_unlimited);
    const hasDaysLeft = isPro && daysLeft > 0;
    const progressPercentage = hasDaysLeft && totalDays > 0 ? Math.min(100, Math.max(0, (daysLeft / totalDays) * 100)) : 0;

    // Stats Mapping
    const cups = user?.trophies || 0;
    const xp = user?.xp_points || 0;
    const level = user?.xp_level || 1;

    // Fixed XP Calculation Logic
    const getLevelMinXp = (lvl: number) => 100 * Math.pow(lvl - 1, 2);
    const currentLevelMinXp = getLevelMinXp(level);
    const nextLevelMinXp = getLevelMinXp(level + 1);
    const currentLevelProgress = xp - currentLevelMinXp;
    const xpNeededForNextLevel = nextLevelMinXp - currentLevelMinXp;
    const xpProgress = Math.min(100, Math.max(0, (currentLevelProgress / xpNeededForNextLevel) * 100));
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }} onClick={onClose}
                        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
                        aria-hidden="true"
                    />

                    <motion.div
                        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 250 }}
                        className="fixed top-0 right-0 bottom-0 z-[110] w-[85vw] max-w-[340px] bg-[var(--bg-card)] flex flex-col overflow-hidden rounded-l-3xl border-l border-[var(--border)] shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                            <img
                                alt="Logo"
                                className="h-12 w-auto"
                                src={theme === 'dark' ? '/logo.png' : '/logo2.png'}
                            />

                            <button onClick={onClose} className="p-2 rounded-full text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide p-5 space-y-6">

                            {/* Modern Profile Card */}
                            <div className="bg-[var(--bg-element)] rounded-2xl p-4 border border-[var(--border)]">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div className="min-w-0 text-right">
                                        <h3 className="truncate text-sm font-bold text-[var(--text-primary)]">{fullName}</h3>
                                        <p className="mt-1 text-[12px] font-medium text-[var(--text-muted)]" dir="ltr">{user?.phone || '—'}</p>
                                    </div>
                                    <img src={`${user?.avatar_url}`} alt={fullName} className="h-12 w-12 shrink-0 rounded-full border border-[var(--border)] object-cover" />
                                </div>

                                {/* Bottom: Trophies & XP (Side by Side) */}
                                <div className="flex items-center gap-4 bg-[var(--bg-app)] rounded-xl p-3 border border-[var(--border)]">

                                    {/* Right Side: Trophies */}
                                    <div className="flex flex-col items-center justify-center min-w-[3.5rem] border-l border-[var(--border)] pl-4">
                                        <Trophy size={20} className="text-yellow-500 mb-1 drop-shadow-sm" />
                                        <span className="text-sm font-black text-[var(--text-primary)] leading-none">{cups}</span>
                                    </div>

                                    {/* Left Side: XP Progress */}
                                    <div className="flex-1 space-y-1.5 pt-0.5">
                                        <div className="flex justify-between items-end">
                                            <span className="text-xs font-bold text-[var(--color-primary-600)] dark:text-[var(--color-primary-400)]">سطح {level}</span>
                                            <span className="text-[10px] font-medium text-[var(--text-muted)] tracking-wide">{currentLevelProgress} / {xpNeededForNextLevel} XP</span>
                                        </div>
                                        <div className="h-2 w-full bg-[var(--bg-element)] rounded-full overflow-hidden border border-[var(--border)]">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${xpProgress}%` }}
                                                transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                                                className="h-full bg-[var(--color-primary-500)] rounded-full"
                                            />
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {isPro && (
                                <PlanStatusCard
                                    planId={currentPlanKey}
                                    name={user?.plan_name || planDetails.label}
                                    color={user?.plan_icon_primary || planDetails.hexColor}
                                    progress={unlimited ? 100 : progressPercentage}
                                    days={daysLeft}
                                    unlimited={unlimited}
                                    onClick={() => setIsPlanModalOpen(true)}
                                />
                            )}

                            {/* Nav Menu */}
                            <nav>
                                <div className="text-xs font-bold text-[var(--text-muted)] mb-3 px-2">منوی اصلی</div>
                                <motion.ul variants={containerVariants} initial="hidden" animate="show" className="space-y-1">
                                    {menuItems.map((item) => {
                                        const isActive = activeView === item.id;
                                        return (
                                            <motion.li key={item.id} variants={itemVariants}>
                                                <button
                                                    onClick={() => { onNavigate(item.id); onClose(); }}
                                                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${
                                                        isActive
                                                            ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-600)] dark:bg-[var(--color-primary-600)]/20 dark:text-[var(--color-primary-400)]'
                                                            : 'text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {item.icon ? (
                                                            <item.icon size={18} className={isActive ? 'animate-pulse' : ''} />
                                                        ) : (
                                                            <MetNavIcon size={20} active={isActive} />
                                                        )}
                                                        <span className="font-medium text-sm">{item.label}</span>
                                                    </div>
                                                    {isActive && <ChevronLeft size={16} />}
                                                </button>
                                            </motion.li>
                                        );
                                    })}
                                </motion.ul>
                            </nav>
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-[var(--border)] mt-auto space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <span className="text-sm font-medium text-[var(--text-secondary)]">حالت شب</span>
                                <ThemeSwitch theme={theme} onToggle={onToggleTheme} />
                            </div>
                            <button
                                onClick={() => { onLogout(); onClose(); }}
                                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-[var(--error)] bg-[var(--error)]/5 hover:bg-[var(--error)]/10 transition-colors text-sm font-bold"
                            >
                                <LogOut size={16} />
                                <span>خروج از حساب</span>
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
            <PlanSelectionModal
                isOpen={isPlanModalOpen}
                onClose={() => setIsPlanModalOpen(false)}
            />
        </AnimatePresence>

    );
};