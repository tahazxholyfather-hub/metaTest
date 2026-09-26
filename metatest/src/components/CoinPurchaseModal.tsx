import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Coins, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { flowApi } from '../lib/authApi';
import { PremiumUpgrade } from './PremiumUpgrade';

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

function toman(value: number) {
    return new Intl.NumberFormat('fa-IR').format(value);
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
                if (alive) toast.error('دریافت بسته‌های سکه ناموفق بود.');
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
                toast.error(res.message || 'پرداخت سکه شروع نشد.');
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
        <AnimatePresence>
            {isOpen && (
                <div dir="rtl" className="fixed inset-0 z-[9999] flex items-end justify-center p-0 sm:items-center sm:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ y: 24, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 24, opacity: 0 }}
                        className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl sm:rounded-3xl"
                    >
                        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                            <div>
                                <h2 className="text-lg font-black text-[var(--text-primary)]">خرید سکه</h2>
                                <p className="mt-0.5 text-xs text-[var(--text-muted)]">برای ادامه گفتگو با مِت</p>
                            </div>
                            <button type="button" onClick={onClose} className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-[var(--hover-overlay)]" aria-label="بستن">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="overflow-y-auto px-5 py-5">
                            {loading ? (
                                <div className="flex justify-center py-10 text-[var(--text-muted)]"><Loader2 className="animate-spin" size={22} /></div>
                            ) : !canPurchase ? (
                                <PremiumUpgrade
                                    icon={Coins}
                                    title="خرید سکه با پلن پولی"
                                    description="سکه‌های خریدنی برای طرح‌های پولی است. اول پلن را ارتقا بده، بعد هر بسته‌ای که خواستی را بردار."
                                    actionLabel="ارتقا پلن"
                                    onAction={onRequirePlan}
                                />
                            ) : (
                                <div className="space-y-3">
                                    {packages.map((pack) => {
                                        const active = pack.id === selectedId;
                                        return (
                                            <button
                                                key={pack.id}
                                                type="button"
                                                onClick={() => setSelectedId(pack.id)}
                                                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-right transition-colors ${active ? 'border-[var(--text-primary)] bg-[var(--bg-element)]' : 'border-[var(--border)] bg-transparent'}`}
                                            >
                                                <span>
                                                    <span className="block text-sm font-extrabold text-[var(--text-primary)]">{pack.title}</span>
                                                    {pack.subtitle && <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{pack.subtitle}</span>}
                                                </span>
                                                <span className="text-sm font-black text-[var(--text-primary)]">{toman(pack.priceToman)} تومان</span>
                                            </button>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        disabled={!selectedId || paying}
                                        onClick={() => void buy()}
                                        className="mt-2 flex h-11 w-full items-center justify-center rounded-full bg-[var(--text-primary)] text-sm font-extrabold text-[var(--bg-card)] disabled:opacity-50"
                                    >
                                        {paying ? <Loader2 className="animate-spin" size={18} /> : 'پرداخت و دریافت سکه'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
