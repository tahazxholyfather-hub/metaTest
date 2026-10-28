// src/components/CoinBadge.tsx
import React from 'react';
import { Award } from 'lucide-react';



type CoinBadgeProps = {
    count: number;
};

export const CoinBadge: React.FC<CoinBadgeProps> = ({ count }) => {
    return (
        <div className="flex items-center gap-2 h-9 px-3 rounded-full bg-[var(--bg-element)] border border-[var(--border)] shadow-sm">
            <Award className="text-[var(--coin)] drop-shadow-[0_0_6px_color-mix(in_srgb,var(--coin)_45%,transparent)]" size={18} strokeWidth={2.5} />
            <span className="font-bold text-sm text-[var(--text-primary)] tracking-tighter pt-0.5">
                {new Intl.NumberFormat('fa-IR').format(count)}
            </span>
        </div>
    );
};

