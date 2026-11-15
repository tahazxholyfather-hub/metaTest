import React, { useEffect, useState } from 'react';
import { Plus, Loader2, AlertCircle, CheckCircle2, RefreshCw, Shield } from 'lucide-react';
import { adminApi } from '../lib/adminApi';
import type { User } from './AuthView';
import type { AdminSection } from './access';
import { CustomSelect } from './EditQuestions';

interface AdminRow {
    id: number;
    username: string;
    fullName?: string;
    role: string;
    status?: string;
    isSuper?: boolean;
    lastLogin?: string | null;
    sections?: Record<string, boolean>;
}

interface RolePreset {
    key: string;
    label: string;
    sections: Record<string, boolean>;
}

interface Draft {
    username: string;
    fullName: string;
    password: string;
}

const FALLBACK_ROLES = [
    { id: 'admin', title: 'مدیر' },
    { id: 'selector', title: 'سلکتور' },
    { id: 'typing', title: 'تایپ' },
];

const EMPTY = { username: '', password: '', fullName: '', role: 'admin' };

function defaultGrants(catalog: AdminSection[]) {
    return Object.fromEntries(catalog.map((section) => [section.key, Boolean(section.defaultAllowed)]));
}

function chipClass(on: boolean) {
    return `px-3 py-1.5 rounded-full text-[11px] font-bold border disabled:opacity-70 ${on ? 'bg-[#e8f0fe] text-[#1a73e8] border-[#1a73e8]' : 'border-[#dadce0] dark:border-[#444746] text-[#86868b]'}`;
}

export default function AdminsManager({ currentUser }: { currentUser: User }) {
    const isMain = Boolean(currentUser.isSuper || Number(currentUser.id) === 1);
    const [admins, setAdmins] = useState<AdminRow[]>([]);
    const [catalog, setCatalog] = useState<AdminSection[]>([]);
    const [roles, setRoles] = useState<RolePreset[]>([]);
    const [grants, setGrants] = useState<Record<string, boolean>>({});
    const [drafts, setDrafts] = useState<Record<number, Draft>>({});
    const [savingAccessId, setSavingAccessId] = useState<number | null>(null);
    const [savingProfileId, setSavingProfileId] = useState<number | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY);

    const roleOptions = roles.length
        ? roles.map((role) => ({ id: role.key, title: role.label }))
        : FALLBACK_ROLES;

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminApi.listAdmins();
            if (!res.success) throw new Error(res.message);
            let rows = (res.admins || []) as AdminRow[];
            if (isMain) {
                const access = await adminApi.listAccess();
                if (!access.success) throw new Error(access.message || 'بارگذاری دسترسی‌ها ناموفق بود');
                const nextCatalog = (access.catalog || []) as AdminSection[];
                const nextRoles = (access.roles || []) as RolePreset[];
                const byId = new Map((access.admins || []).map((row: AdminRow) => [Number(row.id), row.sections || {}]));
                rows = rows.map((row) => ({ ...row, sections: byId.get(row.id) || {} }));
                setCatalog(nextCatalog);
                setRoles(nextRoles);
                const starter = nextRoles.find((role) => role.key === 'admin')?.sections || defaultGrants(nextCatalog);
                setGrants((prev) => (Object.keys(prev).length ? prev : starter));
            }
            setAdmins(rows);
            setDrafts(Object.fromEntries(rows.map((row) => [row.id, {
                username: row.username,
                fullName: row.fullName || '',
                password: '',
            }])));
        } catch (err: any) {
            setError(err.message || 'بارگذاری ادمین‌ها ناموفق بود');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);
    useEffect(() => {
        if (!success) return;
        const t = setTimeout(() => setSuccess(null), 3500);
        return () => clearTimeout(t);
    }, [success]);

    const applyRoleToForm = (role: string) => {
        const preset = roles.find((item) => item.key === role);
        setForm({ ...form, role });
        if (preset) setGrants({ ...preset.sections });
    };

    const create = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await adminApi.createAdmin(form);
            if (!res.success || !res.admin?.id) throw new Error(res.message || 'ساخت ادمین ناموفق بود');
            if (isMain) {
                const saved = await adminApi.saveAccess(Number(res.admin.id), grants);
                if (!saved.success) throw new Error(saved.message || 'ادمین ساخته شد ولی ذخیره دسترسی ناموفق بود');
            }
            setSuccess(`ادمین ${form.username} ساخته شد`);
            setForm(EMPTY);
            await load();
            const starter = roles.find((role) => role.key === 'admin')?.sections || defaultGrants(catalog);
            if (isMain) setGrants(starter);
        } catch (err: any) {
            const message = err.message || 'ساخت ادمین ناموفق بود';
            await load();
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    const saveProfile = async (admin: AdminRow) => {
        const draft = drafts[admin.id];
        if (!draft) return;
        if (draft.password && draft.password.length < 8) {
            setError('رمز باید حداقل ۸ کاراکتر باشد.');
            return;
        }
        setSavingProfileId(admin.id);
        setError(null);
        const payload: { username: string; fullName: string; password?: string } = {
            username: draft.username.trim(),
            fullName: draft.fullName.trim(),
        };
        if (draft.password) payload.password = draft.password;
        const res = await adminApi.updateAdmin(admin.id, payload);
        setSavingProfileId(null);
        if (!res.success) { setError(res.message || 'ذخیره مشخصات ناموفق بود'); return; }
        setSuccess('مشخصات ذخیره شد');
        await load();
    };

    const toggleStatus = async (admin: AdminRow) => {
        if (Number(admin.id) === 1) return;
        const next = admin.status === 'disabled' ? 'active' : 'disabled';
        const res = await adminApi.updateAdmin(admin.id, { status: next });
        if (!res.success) { setError(res.message || 'ناموفق بود'); return; }
        setSuccess(next === 'disabled' ? 'ورود این ادمین بسته شد' : 'ورود این ادمین باز شد');
        await load();
    };

    const changeRole = async (admin: AdminRow, role: string | number | null) => {
        if (!role || Number(admin.id) === 1) return;
        const nextRole = String(role);
        const res = await adminApi.updateAdmin(admin.id, { role: nextRole });
        if (!res.success) { setError(res.message || 'ناموفق بود'); return; }
        if (isMain) {
            const preset = roles.find((item) => item.key === nextRole);
            if (preset) {
                const saved = await adminApi.saveAccess(admin.id, preset.sections);
                if (!saved.success) { setError(saved.message || 'الگو ذخیره نشد'); return; }
            }
        }
        setSuccess('الگوی دسترسی اعمال شد. هر بخش را جدا هم می‌توانی عوض کنی.');
        await load();
    };

    const saveSections = async (admin: AdminRow, sections: Record<string, boolean>) => {
        if (!isMain || Number(admin.id) === 1 || savingAccessId != null) return;
        setSavingAccessId(admin.id);
        setError(null);
        setAdmins((prev) => prev.map((row) => row.id === admin.id ? { ...row, sections } : row));
        try {
            const res = await adminApi.saveAccess(admin.id, sections);
            if (!res.success) throw new Error(res.message || 'ذخیره دسترسی ناموفق بود');
            setSuccess(`دسترسی ${admin.username} ذخیره شد`);
        } catch (err: any) {
            const message = err.message || 'ذخیره دسترسی ناموفق بود';
            await load();
            setError(message);
        } finally {
            setSavingAccessId(null);
        }
    };

    const toggleSection = (admin: AdminRow, key: string) => {
        const sections: Record<string, boolean> = {};
        for (const section of catalog) {
            sections[section.key] = section.key === key ? !admin.sections?.[section.key] : Boolean(admin.sections?.[section.key]);
        }
        saveSections(admin, sections);
    };

    const fillSections = (admin: AdminRow, mode: 'all' | 'none' | 'default') => {
        const sections: Record<string, boolean> = {};
        const preset = roles.find((role) => role.key === 'admin')?.sections;
        for (const section of catalog) {
            if (mode === 'all') sections[section.key] = true;
            else if (mode === 'none') sections[section.key] = false;
            else sections[section.key] = preset ? Boolean(preset[section.key]) : Boolean(section.defaultAllowed);
        }
        saveSections(admin, sections);
    };

    const remove = async (admin: AdminRow) => {
        if (Number(admin.id) === 1 || Number(admin.id) === Number(currentUser.id)) return;
        setError(null);
        try {
            const res = await adminApi.deleteAdmin(admin.id);
            if (!res.success) throw new Error(res.message || 'حذف ادمین ناموفق بود');
            setPendingDeleteId(null);
            setSuccess(`ادمین ${admin.username} حذف شد`);
            await load();
        } catch (err: any) {
            setError(err.message || 'حذف ادمین ناموفق بود');
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-wrap items-center justify-between bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4 shadow-sm">
                <div>
                    <h1 className="text-sm font-bold flex items-center gap-2"><Shield size={16} /> ادمین‌ها</h1>
                    <p className="text-xs text-[#86868b] mt-0.5 max-w-2xl">
                        برای هر ادمین چهار تنظیم داری: مشخصات و رمز، باز یا بسته بودن ورود، الگوی دسترسی، و بخش‌هایی که جدا روشن می‌شوند. مدیر اصلی حذف نمی‌شود.
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
                    <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="نام کاربری" className="admin-input" />
                    <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="نام کامل" className="admin-input" />
                    <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="رمز (حداقل ۸)" className="admin-input" autoComplete="new-password" />
                    <CustomSelect searchable={false} value={form.role} options={roleOptions} onChange={(v) => applyRoleToForm(String(v || 'admin'))} />
                    <button onClick={create} disabled={saving || loading || (isMain && catalog.length === 0)} className="flex items-center justify-center gap-2 bg-[#1a73e8] text-white rounded-xl text-xs font-bold py-3 disabled:opacity-60">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} ساخت
                    </button>
                </div>
                {isMain && (
                    <div className="flex flex-wrap gap-2 mt-4">
                        {catalog.map((section) => (
                            <button
                                key={section.key}
                                type="button"
                                onClick={() => setGrants((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
                                className={chipClass(grants[section.key] === true)}
                            >
                                {section.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1a73e8]" /></div>
            ) : (
                <div className="flex flex-col gap-4">
                    {admins.map((admin) => {
                        const locked = Number(admin.id) === 1;
                        const self = Number(admin.id) === Number(currentUser.id);
                        const draft = drafts[admin.id] || { username: admin.username, fullName: admin.fullName || '', password: '' };
                        const busy = savingAccessId === admin.id || savingProfileId === admin.id;
                        return (
                            <div key={admin.id} className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-5 shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                                    <div>
                                        <p className="text-sm font-bold">{admin.fullName || admin.username}</p>
                                        <p className="text-[11px] text-[#86868b]">
                                            شناسه {admin.id} · {locked ? 'مدیر اصلی' : (roles.find((role) => role.key === admin.role)?.label || admin.role)} · آخرین ورود {admin.lastLogin ? new Date(admin.lastLogin).toLocaleString('fa-IR') : 'هرگز'}
                                        </p>
                                    </div>
                                    {locked && <span className="text-[11px] font-bold text-[#1a73e8]">دسترسی کامل</span>}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <input
                                        value={draft.username}
                                        disabled={locked && !self}
                                        onChange={(e) => setDrafts((prev) => ({ ...prev, [admin.id]: { ...draft, username: e.target.value } }))}
                                        placeholder="نام کاربری"
                                        className="admin-input"
                                    />
                                    <input
                                        value={draft.fullName}
                                        disabled={locked && !self}
                                        onChange={(e) => setDrafts((prev) => ({ ...prev, [admin.id]: { ...draft, fullName: e.target.value } }))}
                                        placeholder="نام کامل"
                                        className="admin-input"
                                    />
                                    <input
                                        type="password"
                                        value={draft.password}
                                        onChange={(e) => setDrafts((prev) => ({ ...prev, [admin.id]: { ...draft, password: e.target.value } }))}
                                        placeholder="رمز جدید، اگر می‌خواهی عوض شود"
                                        className="admin-input"
                                        autoComplete="new-password"
                                    />
                                    <button type="button" onClick={() => saveProfile(admin)} disabled={busy} className="rounded-xl bg-[#1a73e8] text-white text-xs font-bold disabled:opacity-60">
                                        {savingProfileId === admin.id ? 'در حال ذخیره' : 'ذخیره مشخصات'}
                                    </button>
                                </div>

                                {!locked && (
                                    <div className="flex flex-wrap items-center gap-2 mt-4">
                                        <button
                                            type="button"
                                            onClick={() => toggleStatus(admin)}
                                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${admin.status === 'disabled' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}
                                        >
                                            {admin.status === 'disabled' ? 'ورود بسته است' : 'ورود باز است'}
                                        </button>
                                        <div className="min-w-[140px]">
                                            <CustomSelect searchable={false} value={admin.role} options={roleOptions} onChange={(v) => changeRole(admin, v)} />
                                        </div>
                                        {isMain && (
                                            <>
                                                <button type="button" onClick={() => fillSections(admin, 'all')} disabled={busy} className={chipClass(false)}>همه بخش‌ها</button>
                                                <button type="button" onClick={() => fillSections(admin, 'default')} disabled={busy} className={chipClass(false)}>پیش‌فرض مدیر</button>
                                                <button type="button" onClick={() => fillSections(admin, 'none')} disabled={busy} className={chipClass(false)}>هیچ‌کدام</button>
                                            </>
                                        )}
                                    </div>
                                )}

                                {isMain && !locked && (
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        {catalog.map((section) => (
                                            <button
                                                key={section.key}
                                                type="button"
                                                disabled={busy}
                                                onClick={() => toggleSection(admin, section.key)}
                                                className={chipClass(admin.sections?.[section.key] === true)}
                                            >
                                                {section.label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {!locked && !self && (
                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        {pendingDeleteId === admin.id ? (
                                            <>
                                                <span className="text-xs font-bold text-red-600">ادمین «{admin.username}» حذف شود؟</span>
                                                <button type="button" onClick={() => remove(admin)} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold">بله، حذف شود</button>
                                                <button type="button" onClick={() => setPendingDeleteId(null)} className="px-3 py-1.5 rounded-lg bg-[#f8f9fa] dark:bg-[#131314] text-xs font-bold">انصراف</button>
                                            </>
                                        ) : (
                                            <button type="button" onClick={() => setPendingDeleteId(admin.id)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-bold">
                                                حذف ادمین
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
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
                .admin-input:disabled { opacity: 0.7; }
            `}</style>
        </div>
    );
}
