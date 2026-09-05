import React, {useState} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Home, BookOpen, FileText, User, LogOut, ChevronLeft,
    Trophy, Crown, Star, Shield, Diamond, Files, GraduationCap
} from 'lucide-react';
import { ThemeSwitch } from './ThemeSwitch';
import { useUser } from '../context/UserContext';
import PlanSelectionModal from "./PlanSelectionModal";

type MobileMenuProps = {
    isOpen: boolean;
    onClose: () => void;
    activeView: string;
    onNavigate: (view: string) => void;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
    onLogout: () => void;
};

const menuItems = [
    { id: 'dashboard', label: 'داشبورد', icon: Home },
    { id: 'practice', label: 'تمرین', icon: BookOpen },
    { id: 'tests', label: 'آزمون‌ها', icon: FileText },
    { id: 'met', label: 'مِت', icon: GraduationCap },
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

// --- Circular Progress Component ---
const CircularProgress = ({ progress, days, colorClass }: { progress: number, days: number, colorClass: string }) => {
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r={radius} stroke="currentColor" strokeWidth="3" fill="transparent" className="text-[var(--border)]" />
                <motion.circle
                    cx="24" cy="24" r={radius} stroke="currentColor" strokeWidth="3" fill="transparent"
                    strokeLinecap="round"
                    className={colorClass}
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1, ease: "easeOut" }}
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
                <span className="text-xs font-bold leading-none mb-0.5">{days}</span>
                <span className="text-[8px] text-[var(--text-muted)] leading-none">روز</span>
            </div>
        </div>
    );
};

export const MobileMenu: React.FC<MobileMenuProps> = ({
                                                          isOpen, onClose, activeView, onNavigate, theme, onToggleTheme, onLogout
                                                      }) => {
    const { user } = useUser();

    // Data Mapping
    const fullName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : 'کاربر مهمان';

    // Map old 'epic' to 'diamond' just in case old data exists, otherwise use current plan
    const rawPlan = user?.current_plan === 'epic' ? 'diamond' : user?.current_plan;
    const currentPlanKey = rawPlan && PLAN_CONFIG[rawPlan] ? rawPlan : 'free';
    const planDetails = PLAN_CONFIG[currentPlanKey];

    // Pro Plan Logic
    const daysLeft = user?.days_remaining || 0;
    const totalDays = planDetails.totalDays;
    const isPro = currentPlanKey !== 'free';
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

    const PlanIcon = planDetails.icon;

    // Shimmer inline style for pro plans
    const shimmerStyle = isPro ? {
        backgroundImage: `linear-gradient(90deg, ${planDetails.hexColor} 0%, #ffffff 50%, ${planDetails.hexColor} 100%)`,
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: 'shimmerText 2.5s linear infinite'
    } : {};

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Add keyframes for shimmer effect globally when menu is open */}
                    <style>{`
                        @keyframes shimmerText {
                            to { background-position: 200% center; }
                        }
                    `}</style>

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
                            <div className="bg-[var(--bg-element)] rounded-2xl p-4 border border-[var(--border)] shadow-sm">

                                {/* Top: User Info & Circle Progress / Upgrade */}
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-[var(--bg-app)] border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0">
                                            <img src={`${user?.avatar_url}`} alt={fullName} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-[var(--text-primary)] text-sm truncate">{fullName}</h3>
                                            <div className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${planDetails.bgLight}`}>
                                                <PlanIcon size={10} className={planDetails.colorClass} />
                                                <span
                                                    className={!isPro ? planDetails.colorClass : ''}
                                                    style={shimmerStyle}
                                                >
                                                    {planDetails.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Right Side */}
                                    {hasDaysLeft ? (
                                        <CircularProgress progress={progressPercentage} days={daysLeft} colorClass={planDetails.colorClass} />
                                    ) : (
                                        !isPro && (
                                            <button
                                                onClick={() => setIsPlanModalOpen(true)}
                                                className="flex flex-col items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 hover:bg-amber-500/20 transition-colors shrink-0"
                                            >
                                                <Crown size={18} className="mb-0.5" />
                                                <span className="text-[9px] font-bold">ارتقا</span>
                                            </button>
                                        )
                                    )}
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
                                                        <item.icon size={18} className={isActive ? 'animate-pulse' : ''} />
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