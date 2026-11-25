import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { Player } from '@lordicon/react';
import { toast } from 'sonner';
import ICON_DATA from '../assets/wired-gradient-290-coin.json';
import { flowApi } from '../lib/authApi';
import { ResponsiveModal } from './ResponsiveModal';

type CoinPackage = {
    id: string;
    coins: number;
    priceToman: number;
    title: string;
    subtitle?: string;
    popular?: boolean;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    /** Free users cannot buy coins. Open the plan picker instead. */
    onRequirePlan: () => void;
};

type PackLook = {
    colors: string;
    border: string;
    shadow: string;
};

const PACK_LOOK: Record<string, PackLook> = {
    'coins-40': {
        colors: 'primary:#F3D36B,secondary:#C4922A',
        border: 'border-[#E8B923]/55',
        shadow: 'shadow-[0_0_24px_rgba(232,185,35,0.16)]',
    },
    'coins-120': {
        colors: 'primary:#FFE08A,secondary:#D4A017',
        border: 'border-[#F5C542]/70',
        shadow: 'shadow-[0_0_28px_rgba(245,197,66,0.22)]',
    },
    'coins-300': {
        colors: 'primary:#F6C445,secondary:#A16207',
        border: 'border-[#E8B923]/60',
        shadow: 'shadow-[0_0_24px_rgba(212,160,23,0.18)]',
    },
};

const FALLBACK_LOOK = PACK_LOOK['coins-120'];

function lookFor(id: string) {
    return PACK_LOOK[id] || FALLBACK_LOOK;
}

function CoinIcon({ colors, size }: { colors: string; size: number }) {
    const playerRef = useRef<Player>(null);

    useEffect(() => {
        const timeout = setTimeout(() => {
            playerRef.current?.playFromBeginning();
        }, 280);
        return () => clearTimeout(timeout);
    }, []);

    return (
        <div className="flex items-center justify-center">
            <Player
                ref={playerRef}
                icon={ICON_DATA}
                size={size}
                state="in-reveal"
                colors={colors}
            />
        </div>
    );
}

export default function CoinPurchaseModal({ isOpen, onClose, onRequirePlan }: Props) {
    const [packages, setPackages] = useState<CoinPackage[]>([]);
    const [canPurchase, setCanPurchase] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [paying, setPaying] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        let alive = true;
        setLoading(true);
        flowApi.getCoinPackages()
            .then((res) => {
                if (!alive) return;
                const list = res.data?.packages || [];
                setPackages(list);
                setCanPurchase(res.data?.canPurchase !== false);
                const popular = list.find((pack) => pack.popular) || list[0];
                setSelectedId(popular?.id || null);
            })
            .catch(() => {
                if (alive) toast.error('بسته‌های سکه دریافت نشد.');
            })
            .finally(() => {
                if (alive) setLoading(false);
            });
        return () => { alive = false; };
    }, [isOpen]);

    const buy = async () => {
        if (!canPurchase) {
            onRequirePlan();
            return;
        }
        if (!selectedId) return;
        setPaying(true);
        try {
            const res = await flowApi.createCoinPayment({ packageId: selectedId });
            if (!res.success || !res.data?.paymentUrl) {
                if (res.code === 'PLAN_REQUIRED') {
                    onRequirePlan();
                    return;
                }
                toast.error(res.message || 'پرداخت شروع نشد.');
                return;
            }
            window.location.href = res.data.paymentUrl;
        } catch {
            toast.error('ارتباط با درگاه پرداخت برقرار نشد.');
        } finally {
            setPaying(false);
        }
    };

    return (
        <ResponsiveModal
            isOpen={isOpen}
            onClose={onClose}
            title="خرید سکه"
            maxWidthClass="md:w-[min(760px,94vw)] md:max-w-[94vw]"
            footer={!loading && packages.length > 0 ? (
                <button
                    type="button"
                    disabled={paying || (canPurchase && !selectedId)}
                    onClick={() => { if (!canPurchase) onRequirePlan(); else void buy(); }}
                    className="flex w-full items-center justify-center gap-3 rounded-xl bg-[var(--accent)] py-4 text-sm font-black text-white shadow-[0_10px_24px_-12px_color-mix(in_srgb,var(--accent)_70%,transparent)] disabled:opacity-60"
                >
                    {paying ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            در حال اتصال...
                        </>
                    ) : canPurchase ? (
                        <>
                            <Check size={18} />
                            تایید و پرداخت
                        </>
                    ) : (
                        'اشتراک ویژه'
                    )}
                </button>
            ) : undefined}
        >
            <div dir="rtl">
                <style>{`
                    @keyframes coinShimmer {
                        0% { background-position: 100% 0; }
                        100% { background-position: -100% 0; }
                    }
                    .coin-shimmer {
                        background: linear-gradient(90deg, #a16207 0%, #f5c542 25%, #fff6d4 50%, #f5c542 75%, #a16207 100%);
                        background-size: 200% auto;
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        animation: coinShimmer 4s linear infinite;
                    }
                `}</style>
                <p className="mb-4 text-xs text-[var(--text-muted)]">
                    {canPurchase ? 'بسته سکه را انتخاب کنید' : 'خرید سکه با اشتراک ویژه فعال می‌شود'}
                </p>

                {loading ? (
                    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3">
                        <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
                        <span className="text-xs text-[var(--text-muted)]">در حال بارگذاری بسته‌ها...</span>
                    </div>
                ) : (
                    <>
                        <div className="hidden gap-4 sm:grid sm:grid-cols-3">
                            {packages.map((pack) => {
                                const active = pack.id === selectedId;
                                const look = lookFor(pack.id);
                                return (
                                    <motion.button
                                        key={pack.id}
                                        type="button"
                                        onClick={() => setSelectedId(pack.id)}
                                        whileHover={{ y: -4 }}
                                        className={`relative flex h-48 flex-col items-center rounded-2xl border p-5 transition-all duration-300 ${
                                            active
                                                ? `${look.shadow} ${look.border} bg-[var(--bg-elevated)]`
                                                : 'border-[var(--border)]/50 bg-[var(--bg-elevated)]/20 hover:bg-[var(--bg-elevated)]/40'
                                        }`}
                                    >
                                        {pack.popular && (
                                            <span className="absolute -top-2 rounded-full bg-gradient-to-r from-[#E8B923] to-[#B8860B] px-3 py-0.5 text-[10px] font-black text-white shadow-lg">
                                                محبوب‌ترین
                                            </span>
                                        )}
                                        <div className="mb-2">
                                            <CoinIcon colors={look.colors} size={64} />
                                        </div>
                                        <h3 className="coin-shimmer mb-1 text-sm font-black">{pack.title}</h3>
                                        <p className="mb-auto text-[10px] text-[var(--text-muted)]">{pack.subtitle}</p>
                                        <span className="mt-3 text-sm font-black">
                                            {pack.priceToman.toLocaleString('fa-IR')}
                                            <small className="text-[9px] font-normal text-[var(--text-muted)]"> تومان</small>
                                        </span>
                                    </motion.button>
                                );
                            })}
                        </div>

                        <div className="flex flex-col gap-3 sm:hidden">
                            {packages.map((pack) => {
                                const active = pack.id === selectedId;
                                const look = lookFor(pack.id);
                                return (
                                    <button
                                        key={pack.id}
                                        type="button"
                                        onClick={() => setSelectedId(pack.id)}
                                        className={`relative flex items-center justify-between rounded-xl border p-4 transition-all ${
                                            active
                                                ? `${look.border} bg-[var(--bg-elevated)] shadow-lg`
                                                : 'border-[var(--border)]/40 bg-[var(--bg-elevated)]/20'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <CoinIcon colors={look.colors} size={40} />
                                            <div className="text-right">
                                                <h3 className="coin-shimmer text-sm font-bold">{pack.title}</h3>
                                                <p className="text-[10px] text-[var(--text-muted)]">{pack.subtitle}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            {pack.popular && (
                                                <span className="mb-1 rounded-full bg-gradient-to-r from-[#E8B923] to-[#B8860B] px-2 py-0.5 text-[9px] font-black text-white">
                                                    محبوب‌ترین
                                                </span>
                                            )}
                                            <span className="text-sm font-black">{pack.priceToman.toLocaleString('fa-IR')}</span>
                                            <span className="text-[9px] text-[var(--text-muted)]">تومان</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </ResponsiveModal>
    );
}
