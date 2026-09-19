import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle2, RefreshCw, Shield } from 'lucide-react';
import { adminApi } from '../lib/adminApi';
import type { User } from './AuthView';
import { CustomSelect } from './EditQuestions';

interface AdminRow {
    id: number;
    username: string;
    fullName?: string;
    role: string;
    status?: string;
    isSuper?: boolean;
    lastLogin?: string | null;
    createdAt?: string | null;
}

const ROLE_OPTIONS = [
    { id: 'admin', title: 'admin' },
    { id: 'selector', title: 'selector' },
    { id: 'typing', title: 'typing' },
];

const EMPTY = { username: '', password: '', fullName: '', role: 'admin' };

export default function AdminsManager({ currentUser }: { currentUser: User }) {
    const [admins, setAdmins] = useState<AdminRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY);
    const [resetId, setResetId] = useState<number | null>(null);
    const [resetPassword, setResetPassword] = useState('');

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminApi.listAdmins();
            if (!res.success) throw new Error(res.message);
            setAdmins((res.admins || []) as AdminRow[]);
        } catch (err: any) {
            setError(err.message || 'Failed to load admins');
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

    const create = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await adminApi.createAdmin(form);
            if (!res.success) throw new Error(res.message);
            setSuccess(`Created ${form.username}`);
            setForm(EMPTY);
            await load();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (admin: AdminRow) => {
        if (admin.id === 1) return;
        const next = admin.status === 'disabled' ? 'active' : 'disabled';
        const res = await adminApi.updateAdmin(admin.id, { status: next });
        if (!res.success) { setError(res.message || 'Failed'); return; }
        await load();
    };

    const changeRole = async (admin: AdminRow, role: string | number | null) => {
        if (!role || admin.id === 1) return;
        const res = await adminApi.updateAdmin(admin.id, { role });
        if (!res.success) { setError(res.message || 'Failed'); return; }
        await load();
    };

    const resetPw = async (id: number) => {
        if (resetPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
        const res = await adminApi.updateAdmin(id, { password: resetPassword });
        if (!res.success) { setError(res.message || 'Failed'); return; }
        setSuccess('Password updated');
        setResetId(null);
        setResetPassword('');
    };

    const remove = async (admin: AdminRow) => {
        if (admin.id === 1 || admin.id === currentUser.id) return;
        if (!window.confirm(`Delete admin “${admin.username}”? This cannot be undone.`)) return;
        const res = await adminApi.deleteAdmin(admin.id);
        if (!res.success) { setError(res.message || 'Failed'); return; }
        await load();
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-wrap items-center justify-between bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4 shadow-sm">
                <div>
                    <h1 className="text-sm font-bold flex items-center gap-2"><Shield size={16} /> Admins</h1>
                    <p className="text-xs text-[#86868b] mt-0.5">Only the main admin (id 1) can manage this list. Passwords are hashed in the database.</p>
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
                <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-4 block">Create admin</label>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="username" className="admin-input" />
                    <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="full name" className="admin-input" />
                    <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="password (min 8)" className="admin-input" />
                    <CustomSelect searchable={false} value={form.role} options={ROLE_OPTIONS} onChange={(v) => setForm({ ...form, role: String(v || 'admin') })} />
                    <button onClick={create} disabled={saving} className="flex items-center justify-center gap-2 bg-[#1a73e8] text-white rounded-xl text-xs font-bold py-3">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1a73e8]" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-[#f8f9fa] dark:bg-[#131314] text-[#86868b] uppercase tracking-wider">
                                <tr>
                                    <th className="text-left p-4">ID</th>
                                    <th className="text-left p-4">Username</th>
                                    <th className="text-left p-4">Name</th>
                                    <th className="text-left p-4">Role</th>
                                    <th className="text-left p-4">Status</th>
                                    <th className="text-left p-4">Last login</th>
                                    <th className="text-right p-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {admins.map((a) => (
                                    <tr key={a.id} className="border-t border-[#dadce0] dark:border-[#333537]">
                                        <td className="p-4 font-mono">{a.id}</td>
                                        <td className="p-4 font-semibold">{a.username}{a.id === 1 ? ' · main' : ''}</td>
                                        <td className="p-4">{a.fullName || '—'}</td>
                                        <td className="p-4 min-w-[140px]">
                                            {a.id === 1 ? (
                                                <span className="text-[#1a73e8] font-bold">super</span>
                                            ) : (
                                                <CustomSelect searchable={false} value={a.role} options={ROLE_OPTIONS} onChange={(v) => changeRole(a, v)} />
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <button
                                                disabled={a.id === 1}
                                                onClick={() => toggleStatus(a)}
                                                className={`px-2.5 py-1 rounded-full font-bold ${a.status === 'disabled' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}
                                            >
                                                {a.status || 'active'}
                                            </button>
                                        </td>
                                        <td className="p-4 text-[#86868b]">{a.lastLogin ? new Date(a.lastLogin).toLocaleString() : 'never'}</td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => { setResetId(a.id); setResetPassword(''); }} className="px-3 py-1.5 rounded-lg bg-[#f8f9fa] dark:bg-[#131314] font-bold">Password</button>
                                                <button disabled={a.id === 1 || a.id === currentUser.id} onClick={() => remove(a)} className="p-2 text-red-500 disabled:opacity-30">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            {resetId === a.id && (
                                                <div className="flex items-center gap-2 mt-2 justify-end">
                                                    <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="new password" className="admin-input w-40" />
                                                    <button onClick={() => resetPw(a.id)} className="px-3 py-1.5 rounded-lg bg-[#1a73e8] text-white font-bold">Save</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
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
