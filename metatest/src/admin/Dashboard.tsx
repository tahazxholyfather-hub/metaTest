import React from 'react';
import {
    Users, BookOpen, Activity, ArrowUpRight, Plus, MoreVertical
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell
} from 'recharts';

// --- MOCK DATA FOR CHARTS ---
const areaData = [
    { name: 'Jan', users: 4000, active: 2400 },
    { name: 'Feb', users: 5000, active: 3200 },
    { name: 'Mar', users: 6500, active: 4800 },
    { name: 'Apr', users: 6000, active: 4200 },
    { name: 'May', users: 8000, active: 5600 },
    { name: 'Jun', users: 9500, active: 7100 },
    { name: 'Jul', users: 12482, active: 8900 },
];

const barData = [
    { subject: 'Math', count: 1240 },
    { subject: 'Physics', count: 850 },
    { subject: 'Chemistry', count: 930 },
    { subject: 'Biology', count: 822 },
];

// --- MOCK DATA FOR STATS ---
const stats = [
    { label: 'Total Users', value: '12,482', trend: '+14%', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Active Questions', value: '3,842', trend: '+5%', icon: BookOpen, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10' },
    { label: 'Platform Activity', value: '89%', trend: '+2%', icon: Activity, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
];

// Custom Tooltip to match dark/light theme seamlessly
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-xl p-4 shadow-xl">
                <p className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span>{entry.name}:</span>
                        <span>{entry.value.toLocaleString()}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export default function Dashboard() {
    return (
        <div className="flex flex-col gap-6 w-full">

            {/* TOP TOOLBAR (Matches EditQuestions Toolbar Style) */}
            <div className="flex flex-wrap items-center justify-between bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4 shadow-sm sticky top-0 z-[40]">
                <div>
                    <h1 className="text-sm font-bold text-gray-800 dark:text-gray-200">System Overview</h1>
                    <p className="text-xs text-[#86868b] mt-0.5">Real-time metrics and database analytics</p>
                </div>
                <button className="flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md">
                    <Plus size={16} /> <span className="hidden sm:inline">Export Report</span>
                    <span className="sm:hidden">Export</span>
                </button>
            </div>

            {/* STATS CARDS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map(({ label, value, trend, icon: Icon, color, bg }, idx) => (
                    <div
                        key={idx}
                        className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 shadow-sm flex flex-col"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <div className={`p-3 rounded-2xl ${bg} ${color}`}>
                                <Icon size={22} />
                            </div>
                            <button className="p-2 text-[#86868b] hover:bg-gray-100 dark:hover:bg-[#2b2d2f] rounded-xl transition-all">
                                <MoreVertical size={18} />
                            </button>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-[#86868b] uppercase tracking-[0.15em] mb-2">
                                {label}
                            </p>
                            <div className="flex items-end gap-4">
                                <span className="text-4xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">
                                    {value}
                                </span>
                                <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-500/10 px-2.5 py-1 rounded-lg mb-1">
                                    {trend}
                                    <ArrowUpRight size={14} />
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* CHARTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. Area Chart (User Growth) */}
                <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col min-h-[400px]">
                    <div className="flex items-center justify-between mb-8">
                        <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-[0.15em]">User Engagement Growth</label>
                    </div>
                    <div className="flex-1 w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={areaData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#1a73e8" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#1a73e8" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#86868b" opacity={0.2} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#86868b' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#86868b' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="users" name="Total Users" stroke="#1a73e8" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                                <Area type="monotone" dataKey="active" name="Active Users" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorActive)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Bar Chart (Questions by Subject) */}
                <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col min-h-[400px]">
                    <div className="flex items-center justify-between mb-8">
                        <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-[0.15em]">Content Distribution</label>
                    </div>
                    <div className="flex-1 w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }} barSize={32}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#86868b" opacity={0.2} />
                                <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#86868b' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#86868b' }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#86868b', opacity: 0.1 }} />
                                <Bar dataKey="count" name="Questions" radius={[6, 6, 6, 6]}>
                                    {barData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={index % 2 === 0 ? '#1a73e8' : '#8ab4f8'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    );
}