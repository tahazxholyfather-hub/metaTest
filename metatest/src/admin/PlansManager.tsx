import { useEffect, useState } from 'react';
import { CreditCard, Loader2, RefreshCw, AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import { flowApi } from '../lib/authApi';

interface ShopPlan {
    id: string;
    name: string;
    days: number;
    price: number;
    planDiscountPercent: number;
    popular: boolean;
    isActive: boolean;
    sortOrder: number;
}

const EMPTY: ShopPlan = {
    id: '',
    name: '',
    days: 30,
    price: 0,
    planDiscountPercent: 0,
    popular: false,
    isActive: true,
    sortOrder: 0,
};

export default function PlansManager() {
    const [plans, setPlans] = useState<ShopPlan[]>([]);
    const [form, setForm] = useState<ShopPlan>(EMPTY);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await flowApi.dispatch('Admin_list_subscription_plans');
            if (!res?.success) throw new Error(res?.message || 'دریافت پلن‌ها ممکن نشد');
            setPlans(((res as { data?: ShopPlan[] }).data) || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'دریافت پلن‌ها ممکن نشد');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const edit = (plan: ShopPlan) => {
        setForm(plan);
        setEditing(true);
        setSuccess(null);
        setError(null);
    };

    const save = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await flowApi.dispatch('Admin_save_subscription_plan', { ...form });
            if (!res?.success) throw new Error(res?.message || 'ذخیره پلن ممکن نشد');
            setSuccess(res.message || 'ذخیره شد');
            setForm(EMPTY);
            setEditing(false);
            await load();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'ذخیره پلن ممکن نشد');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full" dir="rtl">
            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4 shadow-sm">
                <h1 className="text-sm font-bold flex items-center gap-2"><CreditCard size={16} /> پلن‌ها و تعرفه‌ها</h1>
                <p className="text-xs text-[#86868b] mt-1">همین ردیف‌های subscription_plans در «ارتقا پلن» دانش‌آموز و در بخش تعرفه‌های صفحه اصلی دیده می‌شوند. پلن غیرفعال از هر دو حذف می‌شود.</p>
            </div>
            {error && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold"><AlertCircle size={14} /> {error}</div>}
            {success && <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-xl text-xs font-semibold"><CheckCircle2 size={14} /> {success}</div>}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-5">
                <label className="text-xs font-bold flex flex-col gap-1">شناسه
                    <input disabled={editing} value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} className="rounded-xl border border-[#dadce0] dark:border-[#444746] bg-transparent px-3 py-2 font-normal" placeholder="bronze" />
                </label>
                <label className="text-xs font-bold flex flex-col gap-1">نام
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-[#dadce0] dark:border-[#444746] bg-transparent px-3 py-2 font-normal" />
                </label>
                <label className="text-xs font-bold flex flex-col gap-1">روز
                    <input type="number" value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} className="rounded-xl border border-[#dadce0] dark:border-[#444746] bg-transparent px-3 py-2 font-normal" />
                </label>
                <label className="text-xs font-bold flex flex-col gap-1">قیمت (تومان)
                    <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="rounded-xl border border-[#dadce0] dark:border-[#444746] bg-transparent px-3 py-2 font-normal" />
                </label>
                <label className="text-xs font-bold flex flex-col gap-1">تخفیف ٪
                    <input type="number" value={form.planDiscountPercent} onChange={(e) => setForm({ ...form, planDiscountPercent: Number(e.target.value) })} className="rounded-xl border border-[#dadce0] dark:border-[#444746] bg-transparent px-3 py-2 font-normal" />
                </label>
                <label className="text-xs font-bold flex flex-col gap-1">ترتیب
                    <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} className="rounded-xl border border-[#dadce0] dark:border-[#444746] bg-transparent px-3 py-2 font-normal" />
                </label>
                <label className="text-xs font-bold flex items-center gap-2 mt-5"><input type="checkbox" checked={form.popular} onChange={(e) => setForm({ ...form, popular: e.target.checked })} /> پیشنهادی</label>
                <label className="text-xs font-bold flex items-center gap-2 mt-5"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال در فروشگاه و لندینگ</label>
                <div className="md:col-span-2 xl:col-span-4 flex gap-2">
                    <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1a73e8] text-white disabled:opacity-60">{saving ? 'در حال ذخیره' : 'ذخیره پلن'}</button>
                    <button onClick={() => { setForm(EMPTY); setEditing(false); }} className="px-4 py-2 rounded-xl text-xs font-bold border border-[#dadce0] dark:border-[#444746]"><Plus size={14} className="inline" /> پلن تازه</button>
                    <button onClick={load} className="px-4 py-2 rounded-xl text-xs font-bold border border-[#dadce0] dark:border-[#444746]"><RefreshCw size={14} className="inline" /></button>
                </div>
            </div>

            {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1a73e8]" /></div> : (
                <div className="overflow-x-auto bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem]">
                    <table className="w-full text-sm">
                        <thead className="text-[11px] text-[#86868b]"><tr><th className="p-3 text-right">نام</th><th className="p-3">روز</th><th className="p-3">قیمت</th><th className="p-3">تخفیف</th><th className="p-3">وضعیت</th><th /></tr></thead>
                        <tbody>
                            {plans.map((plan) => (
                                <tr key={plan.id} className="border-t border-[#dadce0] dark:border-[#333537]">
                                    <td className="p-3 font-bold">{plan.name}<div className="text-[11px] text-[#86868b] font-normal">{plan.id}</div></td>
                                    <td className="p-3 text-center">{plan.days}</td>
                                    <td className="p-3 text-center">{plan.price.toLocaleString('fa-IR')}</td>
                                    <td className="p-3 text-center">{plan.planDiscountPercent}٪</td>
                                    <td className="p-3 text-center">{plan.isActive ? 'فعال' : 'مخفی'}{plan.popular ? ' · پیشنهادی' : ''}</td>
                                    <td className="p-3 text-left"><button onClick={() => edit(plan)} className="text-xs font-bold text-[#1a73e8]">ویرایش</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
