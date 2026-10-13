import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Coins, Gamepad2, History, MessageSquare, Plus, Settings2, X } from 'lucide-react';
import { Met, chatStatusToMetState, type MetColor } from '../../components/met';
import type { ChatStatus } from './types';
import { faNum, glassClass, springPanel } from './ui';

export type RailPanel = 'history' | 'settings' | 'coins' | 'subjects';

type Props = {
    status: ChatStatus;
    metColor: MetColor;
    audioLevel: number | null;
    coins: number;
    activePanel: RailPanel | null;
    onTogglePanel: (p: RailPanel) => void;
    onChat: () => void;
    onNewChat: () => void;
    onGames: () => void;
    busy?: boolean;
};

function RailButton({
    label,
    active,
    onClick,
    children,
    disabled,
}: {
    label: string;
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            aria-pressed={active}
            title={label}
            className={`group relative w-11 h-11 rounded-[14px] grid place-items-center transition-colors duration-150 active:scale-95 disabled:opacity-40 ${
                active ? 'text-[var(--color-primary-300)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]'
            }`}
        >
            {active && (
                <motion.span
                    layoutId="met-rail-active"
                    className="absolute inset-0 rounded-[14px] bg-[var(--color-primary-500)]/14 border border-[var(--color-primary-500)]/30"
                    transition={springPanel}
                />
            )}
            <span className="relative z-10">{children}</span>
            {/* Tooltip (desktop only) */}
            <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[var(--bg-elevated)] border border-[var(--border)]/70 px-2 py-1 text-[11px] font-bold text-[var(--text-primary)] opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 shadow-lg">
                {label}
            </span>
        </button>
    );
}

/**
 * Desktop: compact floating vertical rail. Sits at the chat's left edge (opposite
 * the app's main SideNav) so the transcript stays centred and uncluttered.
 */
export function MetRail({ status, metColor, audioLevel, coins, activePanel, onTogglePanel, onChat, onNewChat, onGames, busy }: Props) {
    const chatActive = activePanel === null;
    return (
        <motion.nav
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={`flex flex-col items-center gap-1 p-1.5 rounded-[22px] ${glassClass}`}
            aria-label="ابزارهای مِت"
            dir="rtl"
        >
            <button
                type="button"
                onClick={() => onTogglePanel('subjects')}
                className={`relative w-12 h-12 rounded-full grid place-items-center transition-transform active:scale-95 ${activePanel === 'subjects' ? 'ring-2 ring-[var(--color-primary-500)]/50' : ''}`}
                aria-label="انتخاب درس"
                title="انتخاب درس"
            >
                <Met size={40} state={chatStatusToMetState(status)} color={metColor} audioLevel={audioLevel} glow interactive />
            </button>

            <span className="w-6 h-px bg-[var(--border)]/80 my-0.5" aria-hidden />

            <RailButton label="گفتگوی جدید" onClick={onNewChat} disabled={busy}>
                <Plus size={20} strokeWidth={2} />
            </RailButton>
            <RailButton label="گفتگو" active={chatActive} onClick={onChat}>
                <MessageSquare size={19} strokeWidth={1.9} />
            </RailButton>
            <RailButton label="تاریخچه" active={activePanel === 'history'} onClick={() => onTogglePanel('history')}>
                <History size={19} strokeWidth={1.9} />
            </RailButton>
            <RailButton label="تنظیمات" active={activePanel === 'settings'} onClick={() => onTogglePanel('settings')}>
                <Settings2 size={19} strokeWidth={1.9} />
            </RailButton>
            <RailButton label="بازی‌ها و آزمون‌ها" onClick={onGames}>
                <Gamepad2 size={19} strokeWidth={1.9} />
            </RailButton>

            <span className="w-6 h-px bg-[var(--border)]/80 my-0.5" aria-hidden />

            <button
                type="button"
                onClick={() => onTogglePanel('coins')}
                aria-label={`سکه: ${faNum(coins)}`}
                title="سکه‌ها"
                className={`w-11 py-2 rounded-[14px] flex flex-col items-center gap-0.5 transition-colors ${
                    activePanel === 'coins' ? 'bg-[var(--color-primary-500)]/14 border border-[var(--color-primary-500)]/30' : 'hover:bg-[var(--hover-overlay)]'
                }`}
            >
                <Coins size={16} className={coins <= 0 ? 'text-rose-400' : 'text-[var(--coin)]'} strokeWidth={2.2} />
                <motion.span key={coins} initial={{ opacity: 0.4, y: -2 }} animate={{ opacity: 1, y: 0 }} className={`text-[10.5px] font-extrabold tabular-nums ${coins <= 0 ? 'text-rose-400' : 'text-[var(--text-primary)]'}`}>
                    {faNum(coins)}
                </motion.span>
            </button>
        </motion.nav>
    );
}

/** Floating glass panel that opens beside the rail. */
export function RailPanelCard({
    open,
    title,
    onClose,
    children,
    width = 340,
}: {
    open: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    width?: number;
}) {
    return (
        <AnimatePresence>
            {open && (
                <motion.aside
                    key={title}
                    initial={{ opacity: 0, x: -16, scale: 0.98 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -12, scale: 0.98 }}
                    transition={springPanel}
                    className={`flex flex-col rounded-[22px] ${glassClass} overflow-hidden`}
                    style={{ width, maxHeight: 'min(680px, calc(100% - 2rem))' }}
                    dir="rtl"
                    role="dialog"
                    aria-label={title}
                >
                    <div className="flex items-center justify-between px-4 pt-3.5 pb-2 shrink-0">
                        <h2 className="text-[14px] font-extrabold text-[var(--text-primary)] m-0">{title}</h2>
                        <button type="button" onClick={onClose} className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]" aria-label="بستن">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col px-3 pb-3">{children}</div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}

export default MetRail;
