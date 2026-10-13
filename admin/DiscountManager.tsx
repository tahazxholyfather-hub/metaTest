import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle2, RefreshCw, Ticket, Pencil } from 'lucide-react';
import { adminApi } from '../lib/adminApi';

interface Plan {
    id: string;
    name: string;
    price: number;
    isActive: boolean;
}

interface Discount {
    id: number;
    code: string;
    percent: number;
    active: boolean;
    expiresAt: string;
    maxUses: number | null;
    usedCount: number;
    allowedPlanIds: string[];
    createdAt?: string | null;
}

interface FormState {
    code: string;
    percent: string;
    active: boolean;
    expiresAt: string;
    maxUses: string;
    allowedPlanIds: string[];
}

const EMPTY: FormState = {
    code: '',
    percent: '',
    active: true,
    expiresAt: '',
    maxUses: '',
    allowedPlanIds: [],
};

export default function DiscountManager() {
    const [discounts, setDiscounts] = useState<Discount[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [form, setForm] = useState<FormState>(EMPTY);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminApi.listDiscounts();
            if (!res.success) throw new Error(res.message || 'Failed to load discount codes');
            setDiscounts(res.discounts || []);
            setPlans(res.plans || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load discount codes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);
    useEffect(() => {
        if (!success) return;
        const timer = setTimeout(() => setSuccess(null), 3500);
        return () => clearTimeout(timer);
    }, [success]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return discounts;
        return discounts.filter((item) => item.code.toLowerCase().includes(q));
    }, [discounts, query]);

    const togglePlan = (planId: string) => {
        setForm((prev) => ({
            ...prev,
            allowedPlanIds: prev.allowedPlanIds.includes(planId)
                ? prev.allowedPlanIds.filter((id) => id !== planId)
                : [...prev.allowedPlanIds, planId],
        }));
    };

    const startEdit = (item: Discount) => {
        setEditingId(item.id);
        setForm({
            code: item.code,
            percent: String(item.percent),
            active: item.active,
            expiresAt: item.expiresAt || '',
            maxUses: item.maxUses == null ? '' : String(item.maxUses),
            allowedPlanIds: item.allowedPlanIds || [],
        });
        setError(null);
    };

    const resetForm = () => {
        setEditingId(null);
        setForm(EMPTY);
    };

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const payload = {
                code: form.code,
                percent: Number(form.percent),
                active: form.active,
                expiresAt: form.expiresAt || null,
                maxUses: form.maxUses.trim() === '' ? null : Number(form.maxUses),
                allowedPlanIds: form.allowedPlanIds,
            };
            const res = editingId
                ? await adminApi.updateDiscount(editingId, payload)
                : await adminApi.createDiscount(payload);
            if (!res.success) throw new Error(res.message || 'Failed to save');
            setSuccess(editingId ? 'Discount code updated' : 'Discount code created');
            resetForm();
            await load();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (item: Discount) => {
        const warning = item.usedCount > 0
            ? `“${item.code}” has been used ${item.usedCount} time(s). It will be deactivated instead of deleted.`
            : `Delete discount code “${item.code}”?`;
        if (!window.confirm(warning)) return;
        const res = await adminApi.deleteDiscount(item.id);
        if (!res.success) { setError(res.message || 'Failed to delete'); return; }
        setSuccess(res.deactivated ? 'Discount code deactivated' : 'Discount code deleted');
        if (editingId === item.id) resetForm();
        await load();
    };

    const planName = (id: string) => plans.find((plan) => plan.id === id)?.name || id;

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4 shadow-sm">
                <div>
                    <h1 className="text-sm font-bold flex items-center gap-2"><Ticket size={16} /> Discount Codes</h1>
                    <p className="text-xs text-[#86868b] mt-0.5">Create, edit, and turn codes on or off. An empty plan list means the code works on every plan.</p>
                </div>
                <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746]">
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl text-xs font-semibold">
                    <AlertCircle size={14} /> {error}
                </div>
            )}
            {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-500/10 text-green-600 rounded-xl text-xs font-semibold">
                    <CheckCircle2 size={14} /> {success}
                </div>
            )}

            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 shadow-sm">
                <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-4 block">
                    {editingId ? `Edit code #${editingId}` : 'New discount code'}
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    <input dir="ltr" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="code" className="admin-input" />
                    <input dir="ltr" type="number" min="0.01" max="100" step="0.01" value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} placeholder="percent" className="admin-input" />
                    <input dir="ltr" type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="admin-input" />
                    <input dir="ltr" type="number" min="1" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} placeholder="max uses (empty = unlimited)" className="admin-input" />
                    <button type="button" onClick={() => setForm({ ...form, active: !form.active })} className={`rounded-xl text-xs font-bold px-4 py-3 ${form.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {form.active ? 'Active' : 'Inactive'}
                    </button>
                    <div className="flex gap-2">
                        <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-[#1a73e8] text-white rounded-xl text-xs font-bold py-3">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : editingId ? <Pencil size={14} /> : <Plus size={14} />}
                            {editingId ? 'Save changes' : 'Create'}
                        </button>
                        {editingId && (
                            <button onClick={resetForm} className="px-4 rounded-xl text-xs font-bold bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746]">Cancel</button>
                        )}
                    </div>
                </div>
                {plans.length > 0 && (
                    <div className="mt-4">
                        <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-2">Allowed plans</p>
                        <div className="flex flex-wrap gap-2">
                            {plans.map((plan) => {
                                const on = form.allowedPlanIds.includes(plan.id);
                                return (
                                    <button
                                        key={plan.id}
                                        type="button"
                                        onClick={() => togglePlan(plan.id)}
                                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${on ? 'bg-[#e8f0fe] text-[#1a73e8] border-[#1a73e8]' : 'border-[#dadce0] dark:border-[#444746] text-[#444746] dark:text-[#c4c7c5]'}`}
                                    >
                                        {plan.name}{plan.isActive ? '' : ' (inactive)'}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] overflow-hidden shadow-sm">
                <div className="p-4 border-b border-[#dadce0] dark:border-[#333537]">
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search codes" className="admin-input max-w-xs" dir="ltr" />
                </div>
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1a73e8]" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-[#f8f9fa] dark:bg-[#131314] text-[#86868b] uppercase tracking-wider">
                                <tr>
                                    <th className="text-left p-4">Code</th>
                                    <th className="text-left p-4">Percent</th>
                                    <th className="text-left p-4">Uses</th>
                                    <th className="text-left p-4">Expires</th>
                                    <th className="text-left p-4">Plans</th>
                                    <th className="text-left p-4">Status</th>
                                    <th className="text-right p-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((item) => (
                                    <tr key={item.id} className="border-t border-[#dadce0] dark:border-[#333537]">
                                        <td className="p-4 font-mono font-semibold" dir="ltr">{item.code}</td>
                                        <td className="p-4">{item.percent}%</td>
                                        <td className="p-4">{item.usedCount}{item.maxUses == null ? ' / ∞' : ` / ${item.maxUses}`}</td>
                                        <td className="p-4" dir="ltr">{item.expiresAt ? item.expiresAt.replace('T', ' ') : 'never'}</td>
                                        <td className="p-4">{item.allowedPlanIds.length ? item.allowedPlanIds.map(planName).join(', ') : 'all plans'}</td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-full font-bold ${item.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                                {item.active ? 'active' : 'inactive'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => startEdit(item)} className="px-3 py-1.5 rounded-lg bg-[#f8f9fa] dark:bg-[#131314] font-bold">Edit</button>
                                                <button onClick={() => remove(item)} className="p-2 text-red-500"><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {visible.length === 0 && (
                                    <tr><td colSpan={7} className="p-8 text-center text-[#86868b]">No discount codes yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <style>{`
                .admin-input {
                    width: 100%;
                    background: #f8f9fa;
                    border: 1px solid #dadce0;
                    border-radius: 0.75rem;
                    padding: 0.7rem 0.9rem;
                    font-size: 12px;
                    outline: none;
                }
                .dark .admin-input { background: #131314; border-color: #444746; color: #e3e3e3; }
            `}</style>
        </div>
    );
}
