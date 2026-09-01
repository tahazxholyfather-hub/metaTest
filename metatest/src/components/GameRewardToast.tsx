import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { Trophy, Zap, ChevronDown, ChevronUp, Sparkles, Minus } from 'lucide-react';

export interface RewardData {
    previous_status: boolean;
    current_status: string;
    reason: string;
    current_trophies: number;
    current_xp: number;
    added_trophies: number;
    added_xp: number;
    bonus_awarded: boolean;
    bonus_value: number;
    current_level: number;
    leveled_up: boolean;
}

interface GameRewardToastProps {
    data: RewardData | null;
    isOpen: boolean;
    onClose: () => void;
}

type Step = 'idle' | 'trophy' | 'xp' | 'levelup';

const AnimatedNumber = ({ from, to }: { from: number, to: number }) => {
    const nodeRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const node = nodeRef.current;
        if (!node) return;
        const controls = animate(from, to, {
            duration: 1.2,
            ease: [0.16, 1, 0.3, 1],
            onUpdate(value) {
                node.textContent = Math.round(value).toLocaleString('en-US');
            }
        });
        return () => controls.stop();
    }, [from, to]);

    return <span ref={nodeRef}>{from.toLocaleString('en-US')}</span>;
};

const getLevelMinXp = (level: number) => 100 * Math.pow(level - 1, 2);

export const GameRewardToast: React.FC<GameRewardToastProps> = ({ data, isOpen, onClose }) => {
    const [step, setStep] = useState<Step>('idle');

    useEffect(() => {
        if (!isOpen || !data) return;
        let isMounted = true;

        const runSequence = async () => {
            setStep('trophy');
            await new Promise(r => setTimeout(r, 2500));
            if (!isMounted) return;

            setStep('xp');
            await new Promise(r => setTimeout(r, 2500));
            if (!isMounted) return;

            if (data.leveled_up) {
                setStep('levelup');
                await new Promise(r => setTimeout(r, 3000));
                if (!isMounted) return;
            }

            setStep('idle');
            onClose();
        };

        runSequence();
        return () => { isMounted = false; setStep('idle'); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    if (!isOpen || !data || step === 'idle') return null;

    const clamp = (value: number, min: number, max: number) =>
        Math.min(max, Math.max(min, value));

    const safeNumber = (value: unknown, fallback = 0) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    };

    // Calculate start and end values correctly based on backend data
    const startTrophies = safeNumber(data.current_trophies);
    const addedTrophies = safeNumber(data.added_trophies);
    const endTrophies = startTrophies + addedTrophies;

    const startXp = safeNumber(data.current_xp);
    const addedXp = safeNumber(data.added_xp);
    const endXp = startXp + addedXp;

    const currentLevel = Math.max(1, safeNumber(data.current_level, 1));

    const currentLevelMinXp = getLevelMinXp(currentLevel);
    const nextLevelMinXp = getLevelMinXp(currentLevel + 1);
    const levelRange = Math.max(1, nextLevelMinXp - currentLevelMinXp);

    const startPercent = clamp(((startXp - currentLevelMinXp) / levelRange) * 100, 0, 100);
    // If leveled up, animate the bar until it's full (100%)
    const endPercent = data.leveled_up
        ? 100
        : clamp(((endXp - currentLevelMinXp) / levelRange) * 100, 0, 100);

    const radius = 22;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="fixed top-6 left-0 right-0 z-[9999] pointer-events-none flex justify-center drop-shadow-2xl">
            <motion.div
                layout
                initial={{ y: -50, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -50, opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className="relative flex items-center h-16 min-w-[200px] px-5 bg-[var(--bg-card)]/80 backdrop-blur-xl border border-[var(--border)] rounded-full overflow-hidden"
            >
                <AnimatePresence mode="wait">
                    {/* TROPHY STEP */}
                    {step === 'trophy' && (
                        <motion.div
                            key="trophy"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="flex items-center justify-between w-full gap-6"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-amber-500/10 text-amber-500">
                                    <Trophy className="w-5 h-5" strokeWidth={2.5} />
                                </div>
                                <span className="text-xl font-bold text-[var(--text-primary)]">
                                    <AnimatedNumber from={startTrophies} to={endTrophies} />
                                </span>
                            </div>
                            <div className={`flex items-center gap-1 text-sm font-bold ${addedTrophies > 0 ? 'text-green-500' : addedTrophies < 0 ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>
                                {addedTrophies > 0 ? <ChevronUp size={16} strokeWidth={3} /> : addedTrophies < 0 ? <ChevronDown size={16} strokeWidth={3} /> : <Minus size={16} strokeWidth={3} />}
                                <span>{Math.abs(addedTrophies)}</span>
                            </div>
                        </motion.div>
                    )}

                    {/* XP STEP */}
                    {step === 'xp' && (
                        <motion.div
                            key="xp"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="flex items-center justify-between w-full gap-6"
                        >
                            <div className="flex items-center gap-3">
                                <div className="relative flex items-center justify-center w-12 h-12">
                                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
                                        <circle cx="24" cy="24" r={radius} stroke="var(--border)" strokeWidth="4" fill="none" opacity={0.4} />
                                        <motion.circle
                                            cx="24" cy="24" r={radius}
                                            stroke="var(--accent)"
                                            strokeWidth="4"
                                            fill="none"
                                            strokeLinecap="round"
                                            strokeDasharray={circumference}
                                            initial={{ strokeDashoffset: circumference - (startPercent / 100) * circumference }}
                                            animate={{ strokeDashoffset: circumference - (endPercent / 100) * circumference }}
                                            transition={{ duration: 1.2, ease: "easeOut" }}
                                        />
                                    </svg>
                                    <Zap className="w-5 h-5 text-[var(--accent)]" strokeWidth={2.5} />
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-xl font-bold text-[var(--text-primary)]">
                                        <AnimatedNumber from={startXp} to={endXp} />
                                    </span>
                                    <span className="text-xs font-semibold text-[var(--text-muted)] tracking-wider">XP</span>
                                </div>
                            </div>
                            <div className={`flex items-center gap-1 text-sm font-bold ${addedXp > 0 ? 'text-green-500' : addedXp < 0 ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>
                                {addedXp > 0 ? <ChevronUp size={16} strokeWidth={3} /> : addedXp < 0 ? <ChevronDown size={16} strokeWidth={3} /> : <Minus size={16} strokeWidth={3} />}
                                <span>{Math.abs(addedXp)}</span>
                            </div>
                        </motion.div>
                    )}

                    {/* LEVEL UP STEP */}
                    {step === 'levelup' && (
                        <motion.div
                            key="levelup"
                            initial={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
                            transition={{ type: "spring", bounce: 0.6 }}
                            className="flex items-center justify-center w-full gap-3 px-2"
                        >
                            <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest">
                                    Level Up
                                </span>
                                <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">
                                    {data.current_level}
                                </span>
                            </div>
                            <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
