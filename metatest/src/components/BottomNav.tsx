// src/components/BottomNav.tsx
import { Home, BookOpen, ClipboardCheck, User } from 'lucide-react';
import { motion } from 'framer-motion';
import type { View } from '../types';
import { MetNavIcon } from './met';

type BottomNavProps = {
    activeView: View;
    onNavigate: (view: View) => void;
};

const NAV_SPRING = { type: 'spring' as const, stiffness: 520, damping: 42, mass: 0.7 };

export const BottomNav = ({ activeView, onNavigate }: BottomNavProps) => {
    const navItems: { id: View; label: string; icon: React.ElementType | null; className: string }[] = [
        { id: 'dashboard', label: 'خانه', icon: Home, className: 'nav-home' },
        { id: 'practice', label: 'تمرین', icon: BookOpen, className: 'nav-practice' },
        { id: 'tests', label: 'آزمون', icon: ClipboardCheck, className: 'nav-tests' },
        { id: 'met', label: 'مِت', icon: null, className: 'nav-ai-teacher' },
        { id: 'profile', label: 'پروفایل', icon: User, className: 'nav-profile' },
    ];

    return (
        <nav
            className="bottomnav-tour-container pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3"
            style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
            aria-label="ناوبری اصلی"
        >
            <div className="pointer-events-auto mx-auto max-w-lg">
                <div className="relative flex items-stretch justify-between gap-0.5 h-[3.65rem] px-1.5 rounded-[1.35rem] bg-[color-mix(in_srgb,var(--bg-card)_88%,transparent)] backdrop-blur-2xl border border-[var(--border)]/50 shadow-[0_8px_28px_-16px_rgba(15,23,42,0.45)]">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeView === item.id;

                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => onNavigate(item.id)}
                                aria-current={isActive ? 'page' : undefined}
                                aria-label={item.label}
                                className={`${item.className} relative flex-1 min-w-0 h-full min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-[1.1rem]`}
                            >
                                {isActive && (
                                    <motion.span
                                        layoutId="bottom-nav-active"
                                        className="absolute inset-[5px] rounded-[0.95rem] bg-[color-mix(in_srgb,var(--color-primary-500)_14%,transparent)]"
                                        transition={NAV_SPRING}
                                    />
                                )}
                                <span className="relative z-10 flex flex-col items-center justify-center gap-0.5">
                                    {Icon ? (
                                        <motion.span
                                            animate={{ scale: isActive ? 1.08 : 1, y: isActive ? -1 : 0 }}
                                            transition={NAV_SPRING}
                                            className="grid place-items-center"
                                        >
                                            <Icon
                                                className={`w-[22px] h-[22px] transition-colors duration-200 ${
                                                    isActive ? 'text-[var(--color-primary-500)]' : 'text-[var(--text-muted)]'
                                                }`}
                                                strokeWidth={isActive ? 2.2 : 1.85}
                                            />
                                        </motion.span>
                                    ) : (
                                        <motion.span
                                            animate={{ scale: isActive ? 1.08 : 1, y: isActive ? -1 : 0 }}
                                            transition={NAV_SPRING}
                                            className="grid place-items-center"
                                        >
                                            <MetNavIcon size={22} active={isActive} />
                                        </motion.span>
                                    )}
                                    <span
                                        className={`text-[10px] leading-none font-bold tracking-tight transition-colors duration-200 ${
                                            isActive ? 'text-[var(--color-primary-500)]' : 'text-[var(--text-muted)]'
                                        }`}
                                    >
                                        {item.label}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
};
