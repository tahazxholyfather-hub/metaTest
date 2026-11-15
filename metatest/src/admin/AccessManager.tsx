import { useEffect, useState } from 'react';
import { KeyRound, Loader2, RefreshCw, AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import { adminApi } from '../lib/adminApi';
import type { AdminSection } from './access';
import { CustomSelect } from './EditQuestions';

interface AccessAdmin {
    id: number;
    username: string;
    fullName?: string;
    role: string;
    status?: string;
    isSuper?: boolean;
    sections: Record<string, boolean>;
}

const ROLE_OPTIONS = [
    { id: 'admin', title: 'مدیر' },
    { id: 'selector', title: 'سلکتور' },
    { id: 'typing', title: 'تایپ' },
];

const EMPTY_FORM = { username: '', password: '', fullName: '', role: 'admin' };

function defaultGrants(catalog: AdminSection[]) {
    return Object.fromEntries(catalog.map((section) => [section.key, Boolean(section.defaultAllowed)]));
}

export default function AccessManager() {
    const [admins, setAdmins] = useState<AccessAdmin[]>([]);
    const [catalog, setCatalog] = useState<AdminSection[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [grants, setGrants] = useState<Record<string, boolean>>({});
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminApi.listAccess();
            if (!res.success) throw new Error(res.message || 'بارگذاری دسترسی‌ها ناموفق بود');
            setAdmins((res.admins || []) as AccessAdmin[]);
            const nextCatalog = (res.catalog || []) as AdminSection[];
            setCatalog(nextCatalog);
            setGrants((prev) => (Object.keys(prev).length ? prev : defaultGrants(nextCatalog)));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'بارگذاری دسترسی‌ها ناموفق بود');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);
    useEffect(() => {
        if (!success) return;
        const timer = setTimeout(() => setSuccess(null), 2500);
        return () => clearTimeout(timer);
    }, [success]);

    const create = async () => {
        setCreating(true);
        setError(null);
        try {
            const res = await adminApi.createAdmin(form);
            if (!res.success || !res.admin?.id) throw new Error(res.message || 'ساخت ادمین ناموفق بود');
            const adminId = Number(res.admin.id);
            const saved = await adminApi.saveAccess(adminId, grants);
            if (!saved.success) throw new Error(saved.message || 'ادمین ساخته شد ولی ذخیره دسترسی ناموفق بود');
            setSuccess(`ادمین ${form.username} با دسترسی انتخاب‌شده ساخته شد`);
            setForm(EMPTY_FORM);
            await load();
            setGrants(defaultGrants(catalog));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'ساخت ادمین ناموفق بود';
            await load();
            setError(message);
        } finally {
            setCreating(false);
        }
    };

    const toggle = async (admin: AccessAdmin, key: string) => {
        if (admin.isSuper || admin.id === 1) return;
        const next = { ...admin.sections, [key]: !admin.sections[key] };
        const payload: Record<string, boolean> = {};
        for (const section of catalog) payload[section.key] = Boolean(next[section.key]);
        setSavingId(admin.id);
        setError(null);
        setAdmins((prev) => prev.map((row) => row.id === admin.id ? { ...row, sections: { ...row.sections, [key]: payload[key] } } : row));
        try {
            const res = await adminApi.saveAccess(admin.id, payload);
            if (!res.success) throw new Error(res.message || 'ذخیره دسترسی ناموفق بود');
            setAdmins((prev) => prev.map((row) => row.id === admin.id ? { ...row, sections: res.sections || payload } : row));
            setSuccess(`دسترسی ${admin.username} ذخیره شد`);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'ذخیره دسترسی ناموفق بود');
            await load();
        } finally {
            setSavingId(null);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4 shadow-sm">
                <div>
                    <h1 className="text-sm font-bold flex items-center gap-2"><KeyRound size={16} /> دسترسی‌ها</h1>
                    <p className="text-xs text-[#86868b] mt-0.5 max-w-2xl">
                        ادمین جدید را با نام کاربری و رمز دلخواه بساز و همان‌جا بخش‌هایی که می‌بیند را روشن کن. حذف سوالات هم بین همین بخش‌هاست. مدیر اصلی همیشه دسترسی کامل دارد.
                    </p>
                </div>
                <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746]">
                    <RefreshCw size={14} /> بروزرسانی
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
                <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-4 block">ادمین جدید</label>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="نام کاربری" className="access-input" />
                    <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="نام کامل" className="access-input" />
                    <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="رمز (حداقل ۸)" className="access-input" autoComplete="new-password" />
                    <CustomSelect searchable={false} value={form.role} options={ROLE_OPTIONS} onChange={(v) => setForm({ ...form, role: String(v || 'admin') })} />
                    <button type="button" onClick={create} disabled={creating || loading} className="flex items-center justify-center gap-2 bg-[#1a73e8] text-white rounded-xl text-xs font-bold py-3 disabled:opacity-60">
                        {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} ساخت
                    </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                    {catalog.map((section) => {
                        const on = grants[section.key] === true;
                        return (
                            <button
                                key={section.key}
                                type="button"
                                onClick={() => setGrants((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
                                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${on ? 'bg-[#e8f0fe] text-[#1a73e8] border-[#1a73e8]' : 'border-[#dadce0] dark:border-[#444746] text-[#86868b]'}`}
                            >
                                {section.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1a73e8]" /></div>
            ) : (
                <div className="flex flex-col gap-4">
                    {admins.map((admin) => {
                        const locked = Boolean(admin.isSuper || admin.id === 1);
                        return (
                            <div key={admin.id} className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-5 shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                                    <div>
                                        <p className="text-sm font-bold">{admin.fullName || admin.username}</p>
                                        <p className="text-[11px] text-[#86868b]">
                                            {admin.username} · {locked ? 'مدیر اصلی' : (admin.role === 'selector' ? 'سلکتور' : admin.role === 'typing' ? 'تایپ' : 'مدیر')} · {admin.status === 'disabled' ? 'غیرفعال' : 'فعال'}
                                            {savingId === admin.id ? ' · در حال ذخیره' : ''}
                                        </p>
                                    </div>
                                    {locked && <span className="text-[11px] font-bold text-[#1a73e8]">دسترسی کامل</span>}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {catalog.map((section) => {
                                        const on = locked || admin.sections?.[section.key] === true;
                                        return (
                                            <button
                                                key={section.key}
                                                type="button"
                                                disabled={locked || savingId === admin.id}
                                                onClick={() => toggle(admin, section.key)}
                                                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border disabled:opacity-70 ${on ? 'bg-[#e8f0fe] text-[#1a73e8] border-[#1a73e8]' : 'border-[#dadce0] dark:border-[#444746] text-[#86868b]'}`}
                                            >
                                                {section.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <style>{`
                .access-input {
                    width: 100%;
                    background: #f8f9fa;
                    border: 1px solid #dadce0;
                    border-radius: 0.75rem;
                    padding: 0.7rem 0.9rem;
                    font-size: 12px;
                    outline: none;
                }
                .dark .access-input { background: #131314; border-color: #444746; color: #e3e3e3; }
            `}</style>
        </div>
    );
}
