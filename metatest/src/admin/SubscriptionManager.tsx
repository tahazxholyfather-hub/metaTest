import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { adminApi } from '../lib/adminApi';

type PlanDraft = {
    id: string;
    name: string;
    price: string;
    days: string;
    unlimited: boolean;
    isActive: boolean;
    purchasable: boolean;
    popular: boolean;
    sortOrder: string;
};

type RuleDraft = {
    fromPlanId: string;
    toPlanId: string;
    percent: string;
};

const inputClass =
    'w-full rounded-xl border border-[#dadce0] dark:border-[#333537] bg-white dark:bg-[#131314] px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#1a73e8] focus:ring-4 focus:ring-[#1a73e8]/10 transition-all';

function Toggle({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    label: string;
}) {
    return (
        <label className="flex items-center justify-between gap-3 rounded-xl border border-[#dadce0] dark:border-[#333537] px-4 py-3 cursor-pointer">
            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{label}</span>
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="h-5 w-5 accent-[#1a73e8]"
            />
        </label>
    );
}

export default function SubscriptionManager() {
    const [plans, setPlans] = useState<PlanDraft[]>([]);
    const [queueEnabled, setQueueEnabled] = useState(true);
    const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
    const [windowHours, setWindowHours] = useState('72');
    const [rules, setRules] = useState<RuleDraft[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingSettings, setSavingSettings] = useState(false);
    const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
    const [savingRules, setSavingRules] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [creating, setCreating] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [draft, setDraft] = useState({ id: '', name: '', price: '', days: '30', unlimited: false, look: 'silver' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res: any = await adminApi.subscriptionCatalog();
            const data = res?.data || {};
            setPlans(
                (data.plans || []).map((plan: any) => ({
                    id: String(plan.id),
                    name: plan.name || '',
                    price: String(plan.price ?? 0),
                    days: plan.days == null ? '' : String(plan.days),
                    unlimited: Boolean(plan.unlimited || plan.days == null),
                    isActive: Boolean(plan.isActive),
                    purchasable: Boolean(plan.purchasable),
                    popular: Boolean(plan.popular),
                    sortOrder: String(plan.sortOrder ?? 0),
                }))
            );
            setQueueEnabled(Boolean(data.settings?.queueEnabled));
            setLoyaltyEnabled(Boolean(data.settings?.loyaltyEnabled));
            setWindowHours(String(data.settings?.loyaltyWindowHours ?? 72));
            setRules(
                (data.rules || []).map((rule: any) => ({
                    fromPlanId: String(rule.fromPlanId),
                    toPlanId: String(rule.toPlanId),
                    percent: String(rule.percent ?? 0),
                }))
            );
        } catch (err: any) {
            toast.error(err?.message || 'خطا در دریافت اشتراک‌ها');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const updatePlan = (id: string, patch: Partial<PlanDraft>) => {
        setPlans((current) => current.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)));
    };

    const saveSettings = async () => {
        setSavingSettings(true);
        try {
            const res: any = await adminApi.saveSubscriptionSettings({
                queueEnabled,
                loyaltyEnabled,
                loyaltyWindowHours: Number(windowHours),
            });
            await adminApi.saveLoyaltyRules(
                rules.map((rule) => ({
                    fromPlanId: rule.fromPlanId,
                    toPlanId: rule.toPlanId,
                    percent: Number(rule.percent) || 0,
                }))
            );
            toast.success(res?.message || 'تنظیمات ذخیره شد.');
        } catch (err: any) {
            toast.error(err?.message || 'خطا در ذخیره تنظیمات');
        } finally {
            setSavingSettings(false);
        }
    };

    const savePlan = async (plan: PlanDraft) => {
        setSavingPlanId(plan.id);
        try {
            const res: any = await adminApi.saveSubscriptionPlan(plan.id, {
                name: plan.name,
                price: Number(plan.price),
                days: plan.unlimited ? null : Number(plan.days),
                unlimited: plan.unlimited,
                isActive: plan.isActive,
                purchasable: plan.purchasable,
                popular: plan.popular,
                sortOrder: Number(plan.sortOrder) || 0,
            });
            toast.success(res?.message || 'اشتراک ذخیره شد.');
        } catch (err: any) {
            toast.error(err?.message || 'خطا در ذخیره اشتراک');
        } finally {
            setSavingPlanId(null);
        }
    };

    const createPlan = async () => {
        setCreating(true);
        try {
            const res: any = await adminApi.createSubscriptionPlan({
                id: draft.id.trim().toLowerCase(),
                name: draft.name,
                price: Number(draft.price),
                days: draft.unlimited ? null : Number(draft.days),
                unlimited: draft.unlimited,
                look: draft.look,
            });
            toast.success(res?.message || 'اشتراک اضافه شد.');
            setDraft({ id: '', name: '', price: '', days: '30', unlimited: false, look: 'silver' });
            setShowNew(false);
            await load();
        } catch (err: any) {
            toast.error(err?.message || 'خطا در افزودن اشتراک');
        } finally {
            setCreating(false);
        }
    };

    const deletePlan = async (plan: PlanDraft) => {
        if (!window.confirm(`اشتراک «${plan.name}» حذف شود؟ اگر خریدی برایش ثبت شده باشد، حذف انجام نمی‌شود.`)) return;
        setDeletingId(plan.id);
        try {
            const res: any = await adminApi.deleteSubscriptionPlan(plan.id);
            toast.success(res?.message || 'اشتراک حذف شد.');
            await load();
        } catch (err: any) {
            toast.error(err?.message || 'خطا در حذف اشتراک');
        } finally {
            setDeletingId(null);
        }
    };

    const saveRules = async () => {
        setSavingRules(true);
        try {
            const res: any = await adminApi.saveLoyaltyRules(
                rules.map((rule) => ({
                    fromPlanId: rule.fromPlanId,
                    toPlanId: rule.toPlanId,
                    percent: Number(rule.percent) || 0,
                }))
            );
            toast.success(res?.message || 'جدول تخفیف ذخیره شد.');
        } catch (err: any) {
            toast.error(err?.message || 'خطا در ذخیره تخفیف‌ها');
        } finally {
            setSavingRules(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-24 text-[#86868b]" dir="rtl">
                <Loader2 size={22} className="animate-spin text-[#1a73e8]" />
                <span className="text-xs font-bold">در حال دریافت اشتراک‌ها...</span>
            </div>
        );
    }

    return (
        <div className="max-w-5xl space-y-6" dir="rtl">
            <section className="rounded-2xl border border-[#dadce0] dark:border-[#333537] bg-white dark:bg-[#1e1f20] p-6">
                <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">پلن‌های اشتراک</h2>
                <p className="text-xs text-[#86868b] mt-1 leading-6">
                    اشتراک تازه بسازید یا یکی را حذف کنید. اسم، قیمت به تومان و مدت هر اشتراک از همین‌جا عوض می‌شود. «نمایش در فروشگاه» کارت را به کاربر نشان می‌دهد.
                    «قابل خرید» را خاموش کنید تا کارت با پوشش خاکستری دیده شود و دکمه پرداخت برایش کار نکند.
                    مدت خالی یا نامحدود یعنی تاریخ انقضا ندارد.
                </p>
                <div className="mt-4">
                    <button
                        type="button"
                        onClick={() => setShowNew((open) => !open)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#1a73e8] px-4 py-2.5 text-xs font-bold text-[#1a73e8]"
                    >
                        <Plus size={14} />
                        افزودن اشتراک
                    </button>
                </div>
                {showNew && (
                    <div className="mt-4 rounded-2xl border border-dashed border-[#1a73e8]/50 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                            <label className="block">
                                <span className="text-[11px] font-bold text-[#86868b]">شناسه انگلیسی</span>
                                <input className={`${inputClass} mt-1`} value={draft.id} placeholder="platinum" onChange={(event) => setDraft({ ...draft, id: event.target.value })} />
                            </label>
                            <label className="block">
                                <span className="text-[11px] font-bold text-[#86868b]">نام</span>
                                <input className={`${inputClass} mt-1`} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                            </label>
                            <label className="block">
                                <span className="text-[11px] font-bold text-[#86868b]">قیمت (تومان)</span>
                                <input className={`${inputClass} mt-1`} type="number" min={0} value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} />
                            </label>
                            <label className="block">
                                <span className="text-[11px] font-bold text-[#86868b]">ظاهر کارت</span>
                                <select className={`${inputClass} mt-1`} value={draft.look} onChange={(event) => setDraft({ ...draft, look: event.target.value })}>
                                    <option value="bronze">برنزی</option>
                                    <option value="silver">نقره‌ای</option>
                                    <option value="golden">طلایی</option>
                                    <option value="diamond">الماسی</option>
                                </select>
                            </label>
                            <label className="block">
                                <span className="text-[11px] font-bold text-[#86868b]">مدت (روز)</span>
                                <input className={`${inputClass} mt-1 disabled:opacity-50`} type="number" min={1} disabled={draft.unlimited} value={draft.unlimited ? '' : draft.days} placeholder={draft.unlimited ? 'نامحدود' : '۳۰'} onChange={(event) => setDraft({ ...draft, days: event.target.value })} />
                            </label>
                        </div>
                        <div className="mt-3">
                            <Toggle checked={draft.unlimited} onChange={(value) => setDraft({ ...draft, unlimited: value })} label="نامحدود" />
                        </div>
                        <button
                            type="button"
                            onClick={createPlan}
                            disabled={creating}
                            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#1a73e8] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
                        >
                            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            ساخت اشتراک
                        </button>
                    </div>
                )}
                <div className="mt-5 space-y-4">
                    {plans.map((plan) => (
                        <div key={plan.id} className="rounded-2xl border border-[#dadce0] dark:border-[#333537] p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <span className="text-xs font-bold text-[#86868b]">شناسه: {plan.id}</span>
                                <button
                                    type="button"
                                    onClick={() => deletePlan(plan)}
                                    disabled={deletingId === plan.id}
                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-rose-500 hover:bg-rose-500/10 disabled:opacity-60"
                                >
                                    {deletingId === plan.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                    حذف
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                <label className="block">
                                    <span className="text-[11px] font-bold text-[#86868b]">نام</span>
                                    <input className={`${inputClass} mt-1`} value={plan.name} onChange={(event) => updatePlan(plan.id, { name: event.target.value })} />
                                </label>
                                <label className="block">
                                    <span className="text-[11px] font-bold text-[#86868b]">قیمت (تومان)</span>
                                    <input className={`${inputClass} mt-1`} type="number" min={0} value={plan.price} onChange={(event) => updatePlan(plan.id, { price: event.target.value })} />
                                </label>
                                <label className="block">
                                    <span className="text-[11px] font-bold text-[#86868b]">مدت (روز)</span>
                                    <input
                                        className={`${inputClass} mt-1 disabled:opacity-50`}
                                        type="number"
                                        min={1}
                                        disabled={plan.unlimited}
                                        value={plan.unlimited ? '' : plan.days}
                                        placeholder={plan.unlimited ? 'نامحدود' : '۳۰'}
                                        onChange={(event) => updatePlan(plan.id, { days: event.target.value })}
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-[11px] font-bold text-[#86868b]">ترتیب نمایش</span>
                                    <input className={`${inputClass} mt-1`} type="number" value={plan.sortOrder} onChange={(event) => updatePlan(plan.id, { sortOrder: event.target.value })} />
                                </label>
                            </div>
                            <div className="mt-3 grid grid-cols-2 xl:grid-cols-4 gap-2">
                                <Toggle checked={plan.unlimited} onChange={(value) => updatePlan(plan.id, { unlimited: value })} label="نامحدود" />
                                <Toggle checked={plan.isActive} onChange={(value) => updatePlan(plan.id, { isActive: value })} label="نمایش در فروشگاه" />
                                <Toggle checked={plan.purchasable} onChange={(value) => updatePlan(plan.id, { purchasable: value })} label="قابل خرید" />
                                <Toggle checked={plan.popular} onChange={(value) => updatePlan(plan.id, { popular: value })} label="محبوب‌ترین" />
                            </div>
                            <button
                                type="button"
                                onClick={() => savePlan(plan)}
                                disabled={savingPlanId === plan.id}
                                className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#1a73e8] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#1557b0] disabled:opacity-60"
                            >
                                {savingPlanId === plan.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                ذخیره این اشتراک
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-2xl border border-[#dadce0] dark:border-[#333537] bg-white dark:bg-[#1e1f20] p-6">
                <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">صف رزرو</h2>
                <p className="text-xs text-[#86868b] mt-1 leading-6">
                    اگر روشن باشد، کاربری که هنوز اشتراک فعال دارد می‌تواند پلن بعدی را بخرد. آن پلن در صف می‌ماند و
                    درست بعد از پایان اشتراک فعلی (و پلن‌های جلوی صف) فعال می‌شود. اگر خاموش باشد، خرید جدید همان لحظه
                    جایگزین اشتراک فعلی می‌شود.
                </p>
                <div className="mt-4">
                    <Toggle checked={queueEnabled} onChange={setQueueEnabled} label="فعال بودن صف رزرو" />
                </div>
            </section>

            <section className="rounded-2xl border border-[#dadce0] dark:border-[#333537] bg-white dark:bg-[#1e1f20] p-6">
                <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">تخفیف پس از انقضا</h2>
                <p className="text-xs text-[#86868b] mt-1 leading-6">
                    بعد از تمام شدن اشتراک، تا این مدت کاربر می‌تواند پلن تازه‌ای را با درصد جدول بخرد. تا وقتی کلید پایین
                    خاموش است هیچ تخفیفی اعمال نمی‌شود. درصد روی قیمت بعد از تخفیف خود پلن حساب می‌شود و کد تخفیف، اگر باشد،
                    روی مبلغ باقی‌مانده می‌نشیند. هر ردیف یعنی «کاربر این پلن را داشته و تمام شده» و هر ستون یعنی «پلن تازه‌ای که می‌خرد».
                </p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Toggle checked={loyaltyEnabled} onChange={setLoyaltyEnabled} label="فعال بودن تخفیف پس از انقضا" />
                    <label className="block">
                        <span className="text-[11px] font-bold text-[#86868b]">پنجره تخفیف (ساعت)</span>
                        <input className={`${inputClass} mt-1`} type="number" min={1} value={windowHours} onChange={(event) => setWindowHours(event.target.value)} />
                    </label>
                </div>
                <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-xs">
                        <thead>
                            <tr className="text-[#86868b]">
                                <th className="p-2 text-right font-bold">از پلن تمام‌شده</th>
                                {plans.map((plan) => (
                                    <th key={plan.id} className="p-2 text-center font-bold">{plan.name || plan.id}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {plans.map((fromPlan) => (
                                <tr key={fromPlan.id} className="border-t border-[#dadce0] dark:border-[#333537]">
                                    <td className="p-2 font-bold text-gray-800 dark:text-gray-100">{fromPlan.name || fromPlan.id}</td>
                                    {plans.map((toPlan) => {
                                        const rule = rules.find((item) => item.fromPlanId === fromPlan.id && item.toPlanId === toPlan.id);
                                        return (
                                            <td key={toPlan.id} className="p-2">
                                                <input
                                                    className={`${inputClass} text-center`}
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={rule?.percent ?? '0'}
                                                    onChange={(event) => {
                                                        const percent = event.target.value;
                                                        setRules((current) => {
                                                            const next = current.filter((item) => !(item.fromPlanId === fromPlan.id && item.toPlanId === toPlan.id));
                                                            next.push({ fromPlanId: fromPlan.id, toPlanId: toPlan.id, percent });
                                                            return next;
                                                        });
                                                    }}
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button
                    type="button"
                    onClick={saveRules}
                    disabled={savingRules}
                    className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[#1a73e8] px-4 py-2.5 text-xs font-bold text-[#1a73e8] disabled:opacity-60"
                >
                    {savingRules ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    ذخیره جدول تخفیف
                </button>
            </section>

            <button
                type="button"
                onClick={saveSettings}
                disabled={savingSettings}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a73e8] py-3.5 text-sm font-bold text-white hover:bg-[#1557b0] disabled:opacity-60"
            >
                {savingSettings ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                ذخیره صف رزرو و تخفیف پس از انقضا
            </button>
        </div>
    );
}
