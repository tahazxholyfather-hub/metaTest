import React from 'react';
import { ArrowUpRight, ArrowDownRight, LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string;
    trend: string;
    trendUp: boolean;
    icon: LucideIcon;
}

export default function StatCard({ title, value, trend, trendUp, icon: Icon }: StatCardProps) {
    return (
        <div className="bg-white dark:bg-[#1e1f20] p-6 rounded-[2rem] border border-[#dadce0] dark:border-[#333537] hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-white/[0.02] transition-all duration-300 group cursor-default">
            <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-[#f8f9fa] dark:bg-[#2b2d2f] rounded-2xl group-hover:bg-[#e8f0fe] dark:group-hover:bg-[#1a73e8]/20 text-[#1f1f1f] dark:text-[#f5f5f7] group-hover:text-[#1a73e8] transition-colors shadow-sm">
                    <Icon size={20} />
                </div>
                <div className={`flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${trendUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {trendUp ? <ArrowUpRight size={12} className="mr-1" /> : <ArrowDownRight size={12} className="mr-1" />}
                    {trend}
                </div>
            </div>
            <div className="space-y-0.5">
                <p className="text-[11px] font-bold text-[#86868b] uppercase tracking-widest">{title}</p>
                <h3 className="text-2xl font-semibold text-[#1f1f1f] dark:text-[#f5f5f7]">{value}</h3>
            </div>
        </div>
    );
}