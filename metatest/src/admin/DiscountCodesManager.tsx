import React, { useEffect, useMemo, useState } from 'react';
import {
    Plus, Edit2, Trash2, X, Loader2, AlertCircle, Search, RefreshCw,
    CheckCircle2, BadgePercent, Copy, Sparkles, Power, Clock3
} from 'lucide-react';
import { flowApi } from '../lib/authApi';
import type { User } from './AuthView';

interface DiscountCode {
    id: number;
    code: string;
    percent: number;
    active: boolean;
    expires_at: string | null;
    max_uses: number | null;
    used_count: number;
    remaining: number | null;
    created_at?: string;
}

interface FormState {
    id: number | null;
    code: string;
    percent: string;
    max_uses: string;
    expires_at: string;
    active: boolean;
}

const EMPTY_FORM: FormState = {
    id: null,
    code: '',
    percent: '20',
    max_uses: '50',
    expires_at: '',
    active: true,
};

const toDateTimeLocal = (value: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toMysqlDateTime = (value: string) => {
    if (!value) return null;
    return value.replace('T', ' ') + (value.length === 16 ? ':00' : '');
};

const formatFa = (n: number) => n.toLocaleString('fa-IR');

interface Props {
    user: User;
}

export default function DiscountCodesManager({ user }: Props) {
    const canDelete = user.id === 1;
    const [codes, setCodes] = useState<DiscountCode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const fetchCodes = async (term = searchTerm) => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const res = await flowApi.dispatch('Admin_get_discount_codes', { search: term });
            if (!res?.success) {
                setErrorMessage(res?.message || 'دریافت کدهای تخفیف ناموفق بود.');
                return;
            }
            setCodes(Array.isArray(res.codes) ? res.codes : []);
        } catch {
            setErrorMessage('ارتباط با سرور برقرار نشد.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCodes('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return codes;
        return codes.filter((c) => c.code.toLowerCase().includes(q));
    }, [codes, searchTerm]);

    const openAddModal = () => {
        setForm(EMPTY_FORM);
        setIsModalOpen(true);
    };

    const openEditModal = (item: DiscountCode) => {
        setForm({
            id: item.id,
            code: item.code,
            percent: String(item.percent),
            max_uses: item.max_uses == null ? '' : String(item.max_uses),
            expires_at: toDateTimeLocal(item.expires_at),
            active: item.active,
        });
        setIsModalOpen(true);
    };

    const generateLocalCode = () => {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let out = 'MT';
        for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
        setForm((prev) => ({ ...prev, code: out }));
    };

    const handleSave = async () => {
        const percent = Number(form.percent);
        const maxUses = form.max_uses.trim() === '' ? null : Number(form.max_uses);
        if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
            setErrorMessage('درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.');
            return;
        }
        if (maxUses != null && (!Number.isInteger(maxUses) || maxUses < 1)) {
            setErrorMessage('تعداد نفرات باید عدد صحیح بزرگ‌تر از صفر باشد.');
            return;
        }
        setIsSaving(true);
        setErrorMessage(null);
        try {
            const res = await flowApi.dispatch('Admin_save_discount_code', {
                id: form.id,
                code: form.code.trim(),
                percent,
                max_uses: maxUses,
                expires_at: toMysqlDateTime(form.expires_at),
                active: form.active,
            });
            if (!res?.success) {
                setErrorMessage(res?.message || 'ذخیره کد تخفیف ناموفق بود.');
                return;
            }
            setSuccessMessage(res.message || (form.id ? 'کد تخفیف به‌روزرسانی شد.' : 'کد تخفیف ساخته شد.'));
            setIsModalOpen(false);
            setForm(EMPTY_FORM);
            fetchCodes();
        } catch {
            setErrorMessage('ارتباط با سرور برقرار نشد.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggle = async (item: DiscountCode) => {
        try {
            const res = await flowApi.dispatch('Admin_toggle_discount_code', { id: item.id });
            if (!res?.success) {
                setErrorMessage(res?.message || 'تغییر وضعیت ناموفق بود.');
                return;
            }
            setCodes((prev) => prev.map((c) => (c.id === item.id ? { ...c, active: !!res.active } : c)));
        } catch {
            setErrorMessage('ارتباط با سرور برقرار نشد.');
        }
    };

    const handleDelete = async (item: DiscountCode) => {
        if (!canDelete) return;
        setDeletingId(item.id);
        try {
            const res = await flowApi.dispatch('Admin_delete_discount_code', { id: item.id });
            if (!res?.success) {
                setErrorMessage(res?.message || 'حذف ناموفق بود.');
                return;
            }
            setCodes((prev) => prev.filter((c) => c.id !== item.id));
            setSuccessMessage('کد تخفیف حذف شد.');
        } catch {
            setErrorMessage('ارتباط با سرور برقرار نشد.');
        } finally {
            setDeletingId(null);
        }
    };

    const copyCode = async (code: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedCode(code);
            window.setTimeout(() => setCopiedCode(null), 1500);
        } catch {
            setErrorMessage('کپی کد انجام نشد.');
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full" dir="rtl">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-3 shadow-sm sticky top-0 z-[40]">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="جستجوی کد تخفیف"
                        className="w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl pr-9 pl-4 py-2.5 text-xs font-medium outline-none focus:border-[#1a73e8]"
                    />
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => fetchCodes()} disabled={isLoading} className="p-2.5 text-[#86868b] hover:bg-gray-100 dark:hover:bg-[#2b2d2f] rounded-xl disabled:opacity-50">
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={openAddModal} className="flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md">
                        <Plus size={16} /> ساخت کد تخفیف
                    </button>
                </div>
            </div>

            {errorMessage && (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 text-red-600 border border-red-200 dark:border-red-500/20 rounded-[1rem]">
                    <AlertCircle size={20} />
                    <span className="text-sm font-medium flex-1">{errorMessage}</span>
                    <button onClick={() => setErrorMessage(null)}><X size={16} /></button>
                </div>
            )}
            {successMessage && (
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-500/10 text-green-600 border border-green-200 dark:border-green-500/20 rounded-[1rem]">
                    <CheckCircle2 size={20} />
                    <span className="text-sm font-medium flex-1">{successMessage}</span>
                    <button onClick={() => setSuccessMessage(null)}><X size={16} /></button>
                </div>
            )}

            <div className="relative min-h-[200px]">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-10 flex items-center justify-center rounded-[2rem]">
                        <Loader2 className="animate-spin w-8 h-8 text-[#1a73e8]" />
                    </div>
                )}

                {!isLoading && filtered.length === 0 && (
                    <div className="text-center py-16 bg-white dark:bg-[#1e1f20] border border-dashed border-[#dadce0] dark:border-[#333537] rounded-2xl text-sm text-[#86868b]">
                        هنوز کد تخفیفی ساخته نشده. از دکمه ساخت کد تخفیف استفاده کن.
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filtered.map((item) => {
                        const cap = item.max_uses ?? 0;
                        const used = item.used_count || 0;
                        const ratio = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
                        const remaining = item.remaining == null ? null : item.remaining;
                        return (
                            <div key={item.id} className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="p-3 rounded-2xl bg-[#e8f0fe] dark:bg-[#1a73e8]/10 text-[#1a73e8]">
                                        <BadgePercent size={20} />
                                    </div>
                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                                        item.active
                                            ? 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400'
                                            : 'bg-gray-100 text-gray-500 dark:bg-gray-500/10'
                                    }`}>
                                        {item.active ? 'فعال' : 'غیرفعال'}
                                    </span>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-black tracking-wider text-gray-800 dark:text-gray-100" dir="ltr">{item.code}</h3>
                                        <button
                                            type="button"
                                            onClick={() => copyCode(item.code)}
                                            className="p-1.5 rounded-lg text-[#86868b] hover:bg-[#f1f3f4] dark:hover:bg-[#2b2d2f]"
                                            title="کپی کد"
                                        >
                                            {copiedCode === item.code ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-[#86868b] mt-1">{formatFa(item.percent)}٪ تخفیف روی قیمت پلن‌ها</p>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
                                        <span className="text-[#86868b]">استفاده شده</span>
                                        <span className="text-gray-700 dark:text-gray-200">
                                            {formatFa(used)}
                                            {cap > 0 ? ` از ${formatFa(cap)} نفر` : ' نفر'}
                                        </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-[#f1f3f4] dark:bg-[#2b2d2f] overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-[#1a73e8] transition-all"
                                            style={{ width: `${cap > 0 ? ratio : Math.min(100, used ? 12 : 0)}%` }}
                                        />
                                    </div>
                                    <div className="mt-1.5 text-[11px] text-[#86868b]">
                                        {remaining == null ? 'بدون سقف تعداد' : remaining > 0 ? `${formatFa(remaining)} نفر باقی مانده` : 'ظرفیت تکمیل شده'}
                                    </div>
                                </div>

                                {item.expires_at && (
                                    <div className="flex items-center gap-1.5 text-[11px] text-[#86868b]">
                                        <Clock3 size={12} />
                                        انقضا: {new Date(item.expires_at).toLocaleString('fa-IR')}
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f1f3f4] dark:border-[#2b2d2f]">
                                    <button
                                        type="button"
                                        onClick={() => handleToggle(item)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#f8f9fa] dark:bg-[#131314] text-[#444746] dark:text-[#c4c7c5]"
                                    >
                                        <Power size={12} />
                                        {item.active ? 'غیرفعال' : 'فعال'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openEditModal(item)}
                                        className="p-2 rounded-lg text-[#1a73e8] hover:bg-[#e8f0fe] dark:hover:bg-[#1a73e8]/10"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    {canDelete && (
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(item)}
                                            disabled={deletingId === item.id}
                                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50"
                                        >
                                            {deletingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-80 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-3xl p-5 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold">{form.id ? 'ویرایش کد تخفیف' : 'ساخت کد تخفیف'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-lg hover:bg-[#f1f3f4] dark:hover:bg-[#2b2d2f]">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <label className="block text-[11px] font-bold text-[#86868b]">کد</label>
                            <div className="flex gap-2">
                                <input
                                    value={form.code}
                                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                                    placeholder="خالی بگذار تا خودکار ساخته شود"
                                    className="flex-1 bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1a73e8]"
                                    dir="ltr"
                                />
                                <button
                                    type="button"
                                    onClick={generateLocalCode}
                                    className="px-3 rounded-xl bg-[#e8f0fe] text-[#1a73e8] text-[11px] font-bold inline-flex items-center gap-1"
                                >
                                    <Sparkles size={14} /> ساخت
                                </button>
                            </div>

                            <label className="block text-[11px] font-bold text-[#86868b]">درصد تخفیف</label>
                            <input
                                type="number"
                                min={1}
                                max={100}
                                value={form.percent}
                                onChange={(e) => setForm((p) => ({ ...p, percent: e.target.value }))}
                                className="w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1a73e8]"
                            />

                            <label className="block text-[11px] font-bold text-[#86868b]">چند نفر می‌توانند استفاده کنند</label>
                            <input
                                type="number"
                                min={1}
                                value={form.max_uses}
                                onChange={(e) => setForm((p) => ({ ...p, max_uses: e.target.value }))}
                                placeholder="مثلاً ۵۰"
                                className="w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1a73e8]"
                            />

                            <label className="block text-[11px] font-bold text-[#86868b]">تاریخ انقضا (اختیاری)</label>
                            <input
                                type="datetime-local"
                                value={form.expires_at}
                                onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))}
                                className="w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1a73e8]"
                            />

                            <label className="flex items-center gap-2 text-xs font-bold pt-1">
                                <input
                                    type="checkbox"
                                    checked={form.active}
                                    onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                                />
                                کد فعال باشد
                            </label>
                        </div>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="mt-5 w-full py-3 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <BadgePercent size={16} />}
                            {form.id ? 'ذخیره تغییرات' : 'ایجاد کد تخفیف'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
