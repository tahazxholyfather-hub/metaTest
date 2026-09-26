import { useEffect, useState } from 'react';
import { Coins, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { flowApi } from '../lib/authApi';
import { PremiumUpgrade } from './PremiumUpgrade';
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
        <ResponsiveModal
            isOpen={isOpen}
            onClose={onClose}
            title="خرید سکه"
            maxWidthClass="md:w-[440px] md:max-w-[92vw]"
            footer={canPurchase && !loading ? (
                <button
                    type="button"
                    disabled={!selectedId || paying}
                    onClick={() => void buy()}
                    className="flex h-11 w-full items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-extrabold text-[var(--text-inverse)] shadow-[0_10px_24px_-12px_color-mix(in_srgb,var(--accent)_70%,transparent)] disabled:opacity-50"
                >
                    {paying ? <Loader2 className="animate-spin" size={18} /> : 'پرداخت و دریافت سکه'}
                </button>
            ) : undefined}
        >
            <div dir="rtl">
                <p className="mb-4 text-xs text-[var(--text-muted)]">برای ادامه گفتگو با مِت</p>
                {loading ? (
                    <div className="flex justify-center py-10 text-[var(--text-muted)]"><Loader2 className="animate-spin" size={22} /></div>
                ) : !canPurchase ? (
                    <PremiumUpgrade
                        icon={Coins}
                        title="خرید سکه با پلن پولی"
                        description="سکه‌های خریدنی برای طرح‌های پولی است. اول پلن را ارتقا بده، بعد هر بسته‌ای که خواستی را بردار."
                        actionLabel="ارتقا پلن"
                        onAction={onRequirePlan}
                        bare
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
                                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-right transition-colors ${active ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--bg-card))]' : 'border-[var(--border)] bg-[var(--bg-elevated)]'}`}
                                >
                                    <span>
                                        <span className="block text-sm font-extrabold text-[var(--text-primary)]">{pack.title}</span>
                                        {pack.subtitle && <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{pack.subtitle}</span>}
                                    </span>
                                    <span className="text-sm font-black text-[var(--accent)]">{toman(pack.priceToman)} تومان</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </ResponsiveModal>
    );
}
