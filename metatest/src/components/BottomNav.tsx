// src/components/BottomNav.tsx
import { Home, BookOpen, ClipboardCheck, User, GraduationCap } from 'lucide-react';
import type { View } from '../types';

type BottomNavProps = {
    activeView: View;
    onNavigate: (view: View) => void;
};

export const BottomNav = ({ activeView, onNavigate }: BottomNavProps) => {
    // Keep labels short for mobile
    const navItems: { id: View; label: string; icon: React.ElementType; className: string }[] = [
        { id: 'dashboard', label: 'خانه', icon: Home, className: 'nav-home' },
        { id: 'practice', label: 'تمرین', icon: BookOpen, className: 'nav-practice' },
        { id: 'tests', label: 'آزمون', icon: ClipboardCheck, className: 'nav-tests' },
        { id: 'ai_teacher', label: 'معلم ', icon: GraduationCap, className: 'nav-ai-teacher' },
        { id: 'profile', label: 'پروفایل', icon: User, className: 'nav-profile' },
    ];

    return (
        <nav className="bottomnav-tour-container fixed bottom-0 left-0 right-0 bg-[var(--bg-card)]/80 backdrop-blur-xl border-t border-[var(--border)] pb-[env(safe-area-inset-bottom)] z-50">
            <div className="flex items-center justify-around h-16 px-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;

                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={`${item.className} flex-1 flex flex-col items-center justify-center gap-1 h-full relative`}
                        >
                            <Icon
                                className={`w-6 h-6 transition-all duration-300 ${
                                    isActive
                                        ? 'text-[var(--color-primary-500)] scale-110'
                                        : 'text-[var(--text-muted)] scale-100'
                                }`}
                            />
                            <span
                                className={`text-[10px] font-medium transition-colors duration-300 ${
                                    isActive ? 'text-[var(--color-primary-500)]' : 'text-[var(--text-muted)]'
                                }`}
                            >
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};