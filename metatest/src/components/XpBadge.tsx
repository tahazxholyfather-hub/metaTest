// src/components/XpBadge.tsx
import React from 'react';
import { Zap } from 'lucide-react';
import { motion } from 'framer-motion';

type XpBadgeProps = {
    level: number;
    currentXp: number;
};

// Calculate minimum XP required for a given level
// Based on L = floor(0.1 * sqrt(XP)) + 1  => XP = 100 * (L - 1)^2
const getLevelMinXp = (lvl: number) => 100 * Math.pow(lvl - 1, 2);

export const XpBadge: React.FC<XpBadgeProps> = ({ level, currentXp }) => {
    // Calculate boundaries based on the formula
    const currentLevelMinXp = getLevelMinXp(level);
    const nextLevelMinXp = getLevelMinXp(level + 1);

    // Calculate progress within the current level
    const xpIntoLevel = currentXp - currentLevelMinXp;
    const xpRequiredForNextLevel = nextLevelMinXp - currentLevelMinXp;

    // Calculate progress percentage, ensuring it stays between 0 and 100
    const progress = Math.max(0, Math.min(100, (xpIntoLevel / xpRequiredForNextLevel) * 100));

    return (
        <div className="flex items-center gap-2.5 h-9 px-3 rounded-full bg-[var(--bg-element)] border border-[var(--border)] shadow-sm">
            {/* Minimal Icon */}
            <Zap
                className="text-blue-500 drop-shadow-[0_0_6px_rgba(59,130,246,0.4)]"
                size={16}
                strokeWidth={2.5}
                fill="currentColor"
            />

            <div className="flex flex-col justify-center w-16 gap-1">
                {/* Level Text & XP Info */}
                <div className="flex justify-between items-center leading-none">
                    <span className="text-[10px] font-bold text-[var(--text-primary)]">
                        سطح {new Intl.NumberFormat('fa-IR').format(level)}
                    </span>
                </div>

                {/* Smooth Progress Bar */}
                <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden" dir="ltr">
                    <motion.div
                        className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ type: 'spring', bounce: 0, duration: 1.2, delay: 0.2 }}
                    />
                </div>
            </div>
        </div>
    );
};
