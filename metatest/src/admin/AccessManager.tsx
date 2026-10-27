import { useEffect, useState } from 'react';
import { KeyRound, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { flowApi } from '../lib/authApi';

interface AccessAdmin {
    id: number;
    username: string;
    fullName?: string;
    role: string;
    isSuper?: boolean;
    sections: Record<string, boolean>;
}

interface SectionDef {
    key: string;
    label: string;
}

export default function AccessManager() {
    const [admins, setAdmins] = useState<AccessAdmin[]>([]);
    const [catalog, setCatalog] = useState<SectionDef[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await flowApi.dispatch('Admin_list_access');
            if (!res?.success) throw new Error(res?.message || 'دریافت دسترسی‌ها ممکن نشد');
            const data = (res as { data?: { admins?: AccessAdmin[]; catalog?: SectionDef[] } }).data;
            setAdmins(data?.admins || []);
            setCatalog(data?.catalog || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'دریافت دسترسی‌ها ممکن نشد');
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

    const toggle = async (admin: AccessAdmin, key: string) => {
        if (admin.isSuper || admin.id === 1) return;
        const next = { ...admin.sections, [key]: !admin.sections[key] };
        const payload: Record<string, boolean> = {};
        for (const section of catalog) payload[section.key] = Boolean(next[section.key]);
        setSavingId(admin.id);
        setError(null);
        setAdmins((prev) => prev.map((row) => row.id === admin.id ? { ...row, sections: payload } : row));
        try {
            const res = await flowApi.dispatch('Admin_save_access', { adminId: admin.id, sections: payload });
            if (!res?.success) throw new Error(res?.message || 'ذخیره دسترسی ممکن نشد');
            const sections = (res as { data?: { sections?: Record<string, boolean> } }).data?.sections || payload;
            setAdmins((prev) => prev.map((row) => row.id === admin.id ? { ...row, sections } : row));
            setSuccess(`دسترسی ${admin.username} ذخیره شد`);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'ذخیره دسترسی ممکن نشد');
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
                        فقط مدیر اصلی این بخش را می‌بیند. انتشار بلاگ را مثل بقیه قابلیت‌ها برای هر ادمین روشن یا خاموش کنید. مدیر اصلی همیشه دسترسی کامل دارد.
                    </p>
                </div>
                <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746]">
                    <RefreshCw size={14} /> تازه‌سازی
                </button>
            </div>
            {error && <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl text-xs font-semibold"><AlertCircle size={14} /> {error}</div>}
            {success && <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-500/10 text-green-600 rounded-xl text-xs font-semibold"><CheckCircle2 size={14} /> {success}</div>}
            {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1a73e8]" /></div> : (
                <div className="flex flex-col gap-4">
                    {admins.map((admin) => {
                        const locked = Boolean(admin.isSuper || admin.id === 1);
                        return (
                            <div key={admin.id} className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-5 shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                                    <div>
                                        <p className="text-sm font-bold">{admin.fullName || admin.username}</p>
                                        <p className="text-[11px] text-[#86868b]">{admin.username} · {locked ? 'مدیر اصلی' : admin.role}{savingId === admin.id ? ' · در حال ذخیره' : ''}</p>
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
        </div>
    );
}
