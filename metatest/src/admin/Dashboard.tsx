import React, { useEffect, useState } from 'react';
import {
    Users, BookOpen, Activity, CreditCard, Bot, FileWarning, Loader2, AlertCircle, RefreshCw
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell
} from 'recharts';
import { adminApi } from '../lib/adminApi';

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-xl p-4 shadow-xl">
                <p className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span>{entry.name}:</span>
                        <span>{Number(entry.value || 0).toLocaleString()}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const fmt = (n: number | undefined | null) => Number(n || 0).toLocaleString();
const fmtIrr = (n: number | undefined | null) => `${Number(n || 0).toLocaleString()} IRR`;

export default function Dashboard() {
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminApi.dashboard();
            if (!res.success) throw new Error(res.message || 'Failed to load dashboard');
            setData(res);
        } catch (err: any) {
            setError(err.message || 'Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const stats = data?.stats;
    const cards = stats ? [
        { label: 'Total Users', value: fmt(stats.users.total), hint: `+${fmt(stats.users.new7d)} this week`, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
        { label: 'Active Questions', value: fmt(stats.questions.active), hint: `${fmt(stats.questions.total)} total`, icon: BookOpen, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10' },
        { label: 'Logged in (7d)', value: fmt(stats.users.login7d), hint: `${fmt(stats.users.login24h)} in 24h`, icon: Activity, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
        { label: 'Paid Revenue', value: fmtIrr(stats.commerce.revenue), hint: `${fmt(stats.commerce.paid)} paid`, icon: CreditCard, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
        { label: 'AI Conversations', value: fmt(stats.ai.conversations), hint: `${fmt(stats.ai.messages)} messages`, icon: Bot, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
        { label: 'Open Reports', value: fmt(stats.content.reportsPending), hint: `${fmt(stats.content.reportsTotal)} total`, icon: FileWarning, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10' },
    ] : [];

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-wrap items-center justify-between bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4 shadow-sm sticky top-0 z-[40]">
                <div>
                    <h1 className="text-sm font-bold text-gray-800 dark:text-gray-200">System Overview</h1>
                    <p className="text-xs text-[#86868b] mt-0.5">
                        Live metrics from the database{data?.generatedAt ? ` · ${new Date(data.generatedAt).toLocaleString()}` : ''}
                    </p>
                </div>
                <button onClick={load} disabled={loading} className="flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-70 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refresh
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 text-red-600 border border-red-200 dark:border-red-500/20 rounded-2xl">
                    <AlertCircle size={18} />
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {loading && !data ? (
                <div className="flex h-[40vh] items-center justify-center"><Loader2 className="animate-spin text-[#1a73e8]" /></div>
            ) : stats && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                        {cards.map(({ label, value, hint, icon: Icon, color, bg }, idx) => (
                            <div key={idx} className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 shadow-sm">
                                <div className={`p-3 rounded-2xl ${bg} ${color} w-fit mb-6`}>
                                    <Icon size={22} />
                                </div>
                                <p className="text-[11px] font-bold text-[#86868b] uppercase tracking-[0.15em] mb-2">{label}</p>
                                <div className="flex items-end gap-3">
                                    <span className="text-3xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">{value}</span>
                                    <span className="text-xs font-bold text-[#86868b] mb-1">{hint}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            ['Guests', fmt(stats.users.guests)],
                            ['Banned', fmt(stats.users.banned)],
                            ['Answer accuracy', `${stats.learning.accuracy}%`],
                            ['Quizzes created', fmt(stats.learning.quizzes)],
                            ['Quiz results', fmt(stats.learning.quizResults)],
                            ['PDF downloads', fmt(stats.content.pdfDownloads)],
                            ['Page views (7d)', fmt(stats.content.visitors7d)],
                            ['AI coins spent', fmt(stats.ai.coinsSpent)],
                        ].map(([label, value]) => (
                            <div key={String(label)} className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4">
                                <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider">{label}</p>
                                <p className="text-xl font-semibold mt-1">{value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col min-h-[360px]">
                            <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-[0.15em] mb-8">New users (14 days)</label>
                            <div className="flex-1 w-full h-[260px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.charts.userGrowth} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#1a73e8" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#1a73e8" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#86868b" opacity={0.2} />
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#86868b' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#86868b' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="count" name="New users" stroke="#1a73e8" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col min-h-[360px]">
                            <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-[0.15em] mb-8">Questions by subject</label>
                            <div className="flex-1 w-full h-[260px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.questions.bySubject} margin={{ top: 10, right: 0, left: -20, bottom: 0 }} barSize={28}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#86868b" opacity={0.2} />
                                        <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#86868b' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#86868b' }} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#86868b', opacity: 0.1 }} />
                                        <Bar dataKey="count" name="Questions" radius={[6, 6, 6, 6]}>
                                            {(stats.questions.bySubject || []).map((_: any, index: number) => (
                                                <Cell key={index} fill={index % 2 === 0 ? '#1a73e8' : '#8ab4f8'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col min-h-[360px]">
                            <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-[0.15em] mb-8">Page views (14 days)</label>
                            <div className="flex-1 w-full h-[260px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.charts.visitors} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8ab4f8" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#8ab4f8" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#86868b" opacity={0.2} />
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#86868b' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#86868b' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="count" name="Views" stroke="#8ab4f8" strokeWidth={3} fillOpacity={1} fill="url(#colorVisitors)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col min-h-[360px]">
                            <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-[0.15em] mb-8">AI usage (14 days)</label>
                            <div className="flex-1 w-full h-[260px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.charts.aiUsage} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#86868b" opacity={0.2} />
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#86868b' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#86868b' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="count" name="Operations" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAi)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 shadow-sm">
                            <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-[0.15em] mb-4 block">Users by plan</label>
                            <div className="space-y-2">
                                {(stats.users.byPlan || []).map((p: any) => (
                                    <div key={p.name} className="flex items-center justify-between bg-[#f8f9fa] dark:bg-[#131314] rounded-xl px-3 py-2.5">
                                        <span className="text-xs font-semibold">{p.name}</span>
                                        <span className="text-xs text-[#86868b]">{fmt(p.count)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 shadow-sm">
                            <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-[0.15em] mb-4 block">Questions by level</label>
                            <div className="space-y-2">
                                {(stats.questions.byLevel || []).map((p: any) => (
                                    <div key={p.level} className="flex items-center justify-between bg-[#f8f9fa] dark:bg-[#131314] rounded-xl px-3 py-2.5">
                                        <span className="text-xs font-semibold">{p.level}</span>
                                        <span className="text-xs text-[#86868b]">{fmt(p.count)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <RecentCard title="Recent users" rows={(data.recent.users || []).map((u: any) => ({
                            k: u.id, title: u.username, meta: `${u.role} · ${u.current_plan || 'free'}`,
                        }))} />
                        <RecentCard title="Recent payments" rows={(data.recent.payments || []).map((p: any) => ({
                            k: p.id, title: p.username || `user #${p.user_id}`, meta: `${p.status} · ${fmt(p.final_price)}`,
                        }))} />
                        <RecentCard title="Recent reports" rows={(data.recent.reports || []).map((r: any) => ({
                            k: r.id, title: r.issue, meta: `${r.status} · Q${r.question_id}`,
                        }))} />
                    </div>
                </>
            )}
        </div>
    );
}

function RecentCard({ title, rows }: { title: string; rows: { k: any; title: string; meta: string }[] }) {
    return (
        <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 shadow-sm">
            <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-[0.15em]">{title}</label>
            <div className="mt-4 space-y-3">
                {rows.length === 0 && <p className="text-xs text-[#86868b]">No rows yet</p>}
                {rows.map((r) => (
                    <div key={r.k} className="flex items-center justify-between gap-3 bg-[#f8f9fa] dark:bg-[#131314] rounded-xl px-3 py-2.5">
                        <span className="text-xs font-semibold truncate">{r.title}</span>
                        <span className="text-[10px] text-[#86868b] shrink-0">{r.meta}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
