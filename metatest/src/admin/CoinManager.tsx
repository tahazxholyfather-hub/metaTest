import { useEffect, useState } from 'react';
import { AlertCircle, Coins, Loader2, Plus, Trash2 } from 'lucide-react';
import { adminApi } from '../lib/adminApi';

interface PlanOption {
    id: string;
    name: string;
    active: boolean;
}

interface CoinPackage {
    id: string;
    coins: number;
    priceToman: number;
    title: string;
    subtitle: string;
    popular: boolean;
    active: boolean;
}

const inputClass = 'w-full rounded-xl border border-[#dadce0] dark:border-[#444746] bg-[#f8f9fa] dark:bg-[#131314] px-3 py-2 text-xs';

export default function CoinManager() {
    const [plans, setPlans] = useState<PlanOption[]>([]);
    const [daily, setDaily] = useState<Record<string, number>>({ free: 24 });
    const [packages, setPackages] = useState<CoinPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingDaily, setSavingDaily] = useState(false);
    const [savingPackages, setSavingPackages] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminApi.coinCatalog();
            if (!res.success) throw new Error(res.message || 'بارگذاری سکه‌ها ناموفق بود');
            setPlans(res.plans || []);
            setDaily(res.dailyCoins || { free: 24 });
            setPackages(res.packages || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'بارگذاری سکه‌ها ناموفق بود');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const saveDaily = async () => {
        setSavingDaily(true);
        setError(null);
        setNotice(null);
        try {
            const res = await adminApi.saveDailyCoins(daily);
            if (!res.success) throw new Error(res.message || 'ذخیره سکه روزانه ناموفق بود');
            setDaily((current) => ({ ...current, ...(res.dailyCoins || {}) }));
            setNotice(res.message || 'سکه روزانه ذخیره شد.');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'ذخیره سکه روزانه ناموفق بود');
        } finally {
            setSavingDaily(false);
        }
    };

    const savePackages = async () => {
        setSavingPackages(true);
        setError(null);
        setNotice(null);
        try {
            const res = await adminApi.saveCoinPackages(packages);
            if (!res.success) throw new Error(res.message || 'ذخیره قیمت‌ها ناموفق بود');
            setPackages(res.packages || packages);
            setNotice(res.message || 'قیمت بسته‌ها ذخیره شد.');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'ذخیره قیمت‌ها ناموفق بود');
        } finally {
            setSavingPackages(false);
        }
    };

    const updatePackage = (index: number, patch: Partial<CoinPackage>) => {
        setPackages((current) => current.map((pack, i) => (i === index ? { ...pack, ...patch } : pack)));
    };

    const addPackage = () => {
        const id = `pack-${packages.length + 1}`;
        setPackages((current) => [
            ...current,
            { id, coins: 40, priceToman: 39000, title: 'بسته جدید', subtitle: '', popular: false, active: true },
        ]);
    };

    if (loading) {
        return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1a73e8]" /></div>;
    }

    const dailyRows = [
        { id: 'free', name: 'بدون اشتراک' },
        ...plans.map((plan) => ({ id: plan.id, name: plan.name })),
    ];

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4 shadow-sm">
                <h1 className="text-sm font-bold flex items-center gap-2"><Coins size={16} /> مدیریت سکه‌ها</h1>
                <p className="text-xs text-[#86868b] mt-1 max-w-3xl leading-6">
                    سکه روزانه یک بار در هر روز تقویمی، با اولین استفاده از مِت، شارژ می‌شود. اگر وسط روز تمام شود تا فردا دوباره داده نمی‌شود.
                    مانده سکه روزانه فردا می‌سوزد. سکه خریداری‌شده نمی‌سوزد. کاربر بدون اشتراک مقدار کم می‌گیرد و هر اشتراک فعال مقدار خودش را.
                </p>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl text-xs font-semibold">
                    <AlertCircle size={14} /> {error}
                </div>
            )}
            {notice && (
                <div className="p-3 bg-[#e8f0fe] dark:bg-[#1a73e8]/10 text-[#1a73e8] rounded-xl text-xs font-semibold">{notice}</div>
            )}

            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h2 className="text-sm font-bold">سکه روزانه هر پلن</h2>
                    <button type="button" onClick={saveDaily} disabled={savingDaily} className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1a73e8] text-white disabled:opacity-50">
                        {savingDaily ? 'در حال ذخیره' : 'ذخیره سکه روزانه'}
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {dailyRows.map((row) => (
                        <label key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#dadce0] dark:border-[#333537] px-3 py-2">
                            <span className="text-xs font-semibold">{row.name}</span>
                            <input
                                type="number"
                                min={0}
                                value={daily[row.id] ?? 0}
                                onChange={(event) => setDaily((current) => ({ ...current, [row.id]: Number(event.target.value) }))}
                                className="w-28 rounded-lg border border-[#dadce0] dark:border-[#444746] bg-[#f8f9fa] dark:bg-[#131314] px-2 py-1 text-xs text-end"
                            />
                        </label>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 shadow-sm flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-sm font-bold">قیمت بسته‌های سکه</h2>
                    <div className="flex gap-2">
                        <button type="button" onClick={addPackage} className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border border-[#dadce0] dark:border-[#444746]">
                            <Plus size={14} /> بسته جدید
                        </button>
                        <button type="button" onClick={savePackages} disabled={savingPackages || packages.length === 0} className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1a73e8] text-white disabled:opacity-50">
                            {savingPackages ? 'در حال ذخیره' : 'ذخیره قیمت‌ها'}
                        </button>
                    </div>
                </div>
                {packages.length === 0 && <p className="text-xs text-[#86868b]">بسته‌ای تعریف نشده.</p>}
                {packages.map((pack, index) => (
                    <div key={`${pack.id}-${index}`} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end border border-[#dadce0] dark:border-[#333537] rounded-2xl p-3">
                        <label className="text-[10px] text-[#86868b]">شناسه
                            <input value={pack.id} onChange={(event) => updatePackage(index, { id: event.target.value.trim().toLowerCase() })} className={inputClass} />
                        </label>
                        <label className="text-[10px] text-[#86868b]">عنوان
                            <input value={pack.title} onChange={(event) => updatePackage(index, { title: event.target.value })} className={inputClass} />
                        </label>
                        <label className="text-[10px] text-[#86868b]">سکه
                            <input type="number" min={1} value={pack.coins} onChange={(event) => updatePackage(index, { coins: Number(event.target.value) })} className={inputClass} />
                        </label>
                        <label className="text-[10px] text-[#86868b]">قیمت (تومان)
                            <input type="number" min={1000} value={pack.priceToman} onChange={(event) => updatePackage(index, { priceToman: Number(event.target.value) })} className={inputClass} />
                        </label>
                        <label className="text-[10px] text-[#86868b]">توضیح
                            <input value={pack.subtitle || ''} onChange={(event) => updatePackage(index, { subtitle: event.target.value })} className={inputClass} />
                        </label>
                        <div className="flex items-center gap-3 pb-2 text-[10px]">
                            <label className="flex items-center gap-1"><input type="checkbox" checked={pack.popular} onChange={(event) => updatePackage(index, { popular: event.target.checked })} /> پیشنهادی</label>
                            <label className="flex items-center gap-1"><input type="checkbox" checked={pack.active} onChange={(event) => updatePackage(index, { active: event.target.checked })} /> فعال</label>
                            <button type="button" onClick={() => setPackages((current) => current.filter((_, i) => i !== index))} className="text-red-500" aria-label="حذف بسته"><Trash2 size={14} /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
