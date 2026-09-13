import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, Coins, RotateCcw, Sparkles } from 'lucide-react';
import { metApi } from './api';
import type { MetLedgerEntry, MetWallet } from './types';
import { EmptyHint, GraySpinner, SectionLabel, easeOut, faNum, formatRelativeDay, useCountdown } from './ui';

type Props = {
    wallet: MetWallet;
    onRefresh: () => void;
    onBuy?: () => void;
    className?: string;
};

const TYPE_LABEL: Record<string, string> = {
    daily_grant: 'سکه‌ی روزانه',
    daily_expire: 'پایان روز',
    ai_usage: 'مصرف',
    reservation: 'رزرو',
    reservation_release: 'آزادسازی رزرو',
    reservation_settle: 'تسویه',
    refund: 'بازگشت',
    purchase: 'خرید',
    bonus: 'هدیه',
    admin_adjustment: 'اصلاح',
    daily_refill: 'سکه‌ی روزانه',
    ai_message: 'مصرف',
};

const OP_LABEL: Record<string, string> = {
    chat: 'گفتگو',
    stt: 'گفتار به متن',
    tts: 'پاسخ صوتی',
    image_generation: 'ساخت تصویر',
    summary: 'خلاصه‌سازی',
    memory: 'حافظه',
    title: 'عنوان',
};

export function CoinsPanel({ wallet, onRefresh, onBuy, className = '' }: Props) {
    const [ledger, setLedger] = useState<MetLedgerEntry[] | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const countdown = useCountdown(wallet.nextResetAt, true);

    const load = async (reset: boolean) => {
        setLoading(true);
        try {
            const res = await metApi.ledger({ limit: 25, offset: reset ? 0 : ledger?.length || 0 });
            setLedger((prev) => (reset || !prev ? res.items : [...prev, ...res.items]));
            setHasMore(res.hasMore);
        } catch {
            setLedger((prev) => prev || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wallet.total]);

    const quota = Math.max(wallet.dailyQuota || 0, 1);
    const dailyPct = Math.max(0, Math.min(1, wallet.daily / quota));

    return (
        <div className={`flex flex-col min-h-0 h-full ${className}`} dir="rtl">
            {/* Balance card stays put; only the ledger below scrolls. */}
            <div className="relative shrink-0 overflow-hidden rounded-[18px] border border-[var(--border)]/60 p-4 bg-[color-mix(in_srgb,var(--color-primary-500)_8%,var(--bg-card))] mx-1">
                <div className="pointer-events-none absolute -top-10 -left-10 w-36 h-36 rounded-full bg-[var(--color-primary-500)]/20 blur-3xl" />
                <div className="relative flex items-start justify-between gap-3">
                    <div>
                        <div className="text-[11px] text-[var(--text-muted)] font-bold">موجودی سکه</div>
                        <motion.div key={wallet.total} initial={{ opacity: 0.4, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: easeOut }} className="text-[30px] font-black text-[var(--text-primary)] tabular-nums leading-none mt-1.5">
                            {faNum(wallet.total)}
                        </motion.div>
                    </div>
                    <span className="w-10 h-10 rounded-[14px] grid place-items-center bg-amber-400/15 text-amber-400">
                        <Coins size={20} />
                    </span>
                </div>

                <div className="relative mt-4 space-y-2.5">
                    <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-[var(--text-secondary)] font-bold">روزانه</span>
                            <span className="text-[var(--text-muted)] tabular-nums">{faNum(wallet.daily)} / {faNum(wallet.dailyQuota)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                            <motion.div className="h-full rounded-full bg-[var(--color-primary-500)]" animate={{ width: `${dailyPct * 100}%` }} transition={{ duration: 0.5, ease: easeOut }} />
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-1 tabular-nums">شارژ بعدی تا {countdown || '—'} · سکه‌ی روزانه به فردا منتقل نمی‌شود</div>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--text-secondary)] font-bold">خریداری‌شده</span>
                        <span className="text-[var(--text-primary)] font-bold tabular-nums">{faNum(wallet.purchased)}</span>
                    </div>
                </div>

                <div className="relative mt-4 flex items-center gap-2">
                    {onBuy && (
                        <button type="button" onClick={onBuy} className="flex-1 h-9 rounded-[12px] bg-[var(--color-primary-500)] text-white text-[12px] font-extrabold inline-flex items-center justify-center gap-1.5 shadow-[0_8px_20px_-8px_rgba(139,92,246,0.8)] active:scale-[0.98] transition-transform">
                            <Sparkles size={14} /> خرید سکه
                        </button>
                    )}
                    <button type="button" onClick={() => { onRefresh(); void load(true); }} className="h-9 px-3 rounded-[12px] border border-[var(--border)]/70 text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5">
                        <RotateCcw size={13} /> به‌روزرسانی
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto chat-scrollbar px-1 mt-4">
                <SectionLabel className="mb-2">تراکنش‌ها</SectionLabel>
                {ledger === null ? (
                    <div className="py-8 grid place-items-center"><GraySpinner size={16} /></div>
                ) : ledger.length === 0 ? (
                    <EmptyHint title="تراکنشی نیست" body="مصرف و شارژ سکه‌ها اینجا ثبت می‌شود." />
                ) : (
                    <ul className="m-0 p-0 list-none divide-y divide-[var(--border)]/50">
                        {ledger.map((e) => {
                            const positive = e.amount > 0;
                            const label = TYPE_LABEL[e.type] || e.type;
                            const op = e.operationType ? OP_LABEL[e.operationType] || e.operationType : null;
                            return (
                                <li key={e.id} className="flex items-center gap-2.5 py-2">
                                    <span className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${positive ? 'bg-emerald-500/12 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                        {positive ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[12px] font-bold text-[var(--text-primary)] truncate">
                                            {label}{op ? ` · ${op}` : ''}
                                        </div>
                                        <div className="text-[10px] text-[var(--text-muted)] truncate">{e.reason || ''} {formatRelativeDay(e.createdAt)}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className={`text-[12.5px] font-extrabold tabular-nums ${positive ? 'text-emerald-400' : 'text-[var(--text-primary)]'}`} dir="ltr">
                                            {positive ? '+' : ''}{faNum(e.amount)}
                                        </div>
                                        <div className="text-[9.5px] text-[var(--text-muted)] tabular-nums">مانده {faNum(e.balanceAfter)}</div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
                {hasMore && !loading && ledger && (
                    <button type="button" onClick={() => void load(false)} className="mt-1 mb-2 w-full h-9 rounded-[12px] text-[12px] font-bold text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]">
                        نمایش بیشتر
                    </button>
                )}
                {loading && ledger && ledger.length > 0 && <div className="py-3 grid place-items-center"><GraySpinner size={14} /></div>}
                <div className="h-3" />
            </div>
        </div>
    );
}

export default CoinsPanel;
