import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { flowApi } from '../lib/authApi';
import { Loader2, Check, X, Phone, Wallet } from 'lucide-react';
import type { User } from './AuthView';

interface Props {
    user: User;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
    pending: { label: 'در انتظار', cls: 'bg-amber-500/10 text-amber-500' },
    approved: { label: 'تایید شده', cls: 'bg-emerald-500/10 text-emerald-500' },
    paid: { label: 'پرداخت شده', cls: 'bg-blue-500/10 text-blue-500' },
    rejected: { label: 'رد شده', cls: 'bg-rose-500/10 text-rose-500' },
};

const formatMoney = (n: number) => `${Number(n || 0).toLocaleString('fa-IR')} تومان`;

export default function WithdrawalRequests({ user }: Props) {
    const [list, setList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);

    const fetchList = useCallback(async () => {
        setLoading(true);
        try {
            const res: any = await flowApi.dispatch('Admin_get_withdrawal_requests');
            if (res?.success && res?.data) {
                setList(res.data.list || []);
            }
        } catch {
            toast.error('خطا در دریافت درخواست‌های برداشت');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchList();
    }, [fetchList]);

    const updateStatus = async (id: number, status: 'approved' | 'rejected' | 'paid') => {
        setProcessingId(id);
        try {
            const res: any = await flowApi.dispatch('Admin_update_withdrawal_status', { id, status });
            if (res?.success) {
                toast.success('وضعیت درخواست به‌روزرسانی شد.');
                fetchList();
            } else {
                toast.error(res?.message || 'خطا در به‌روزرسانی');
            }
        } catch {
            toast.error('خطا در ارتباط با سرور');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="max-w-3xl space-y-4" dir="rtl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">درخواست‌های برداشت وجه</h2>
                    <p className="text-xs text-[#86868b] mt-1">
                        کاربران درخواست برداشت ثبت کرده‌اند؛ برای پرداخت کارت‌به‌کارت با شماره تماس آن‌ها هماهنگ شوید.
                    </p>
                </div>
                <div className="rounded-xl bg-amber-500/10 text-amber-500 px-3 py-2 text-xs font-bold">
                    {list.filter((r) => r.status === 'pending').length} در انتظار
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-[#86868b]">
                    <Loader2 size={22} className="animate-spin text-[#1a73e8]" />
                    <span className="text-xs font-bold">در حال دریافت...</span>
                </div>
            ) : list.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#dadce0] dark:border-[#333537] py-16 text-[#86868b]">
                    <Wallet size={24} />
                    <span className="text-xs font-bold">هنوز درخواست برداشتی ثبت نشده است.</span>
                </div>
            ) : (
                <div className="space-y-3">
                    {list.map((r) => {
                        const meta = STATUS_META[r.status] || STATUS_META.pending;
                        return (
                            <div
                                key={r.id}
                                className="rounded-2xl border border-[#dadce0] dark:border-[#333537] bg-white dark:bg-[#1e1f20] p-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{r.name}</span>
                                            <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>{meta.label}</span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#86868b]">
                                            <span className="inline-flex items-center gap-1" dir="ltr">
                                                <Phone size={11} /> {r.phone}
                                            </span>
                                            <span>@{r.username}</span>
                                            <span>{new Date(r.createdAt).toLocaleDateString('fa-IR')}</span>
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-start">
                                        <div className="text-lg font-black text-gray-800 dark:text-gray-100" dir="rtl">{formatMoney(r.amount)}</div>
                                    </div>
                                </div>

                                {r.status === 'pending' && (
                                    <div className="mt-3 flex gap-2">
                                        <button
                                            onClick={() => updateStatus(r.id, 'paid')}
                                            disabled={processingId === r.id}
                                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2 text-xs font-bold text-white transition-all hover:bg-emerald-600 disabled:opacity-60"
                                        >
                                            <Check size={14} /> پرداخت شد
                                        </button>
                                        <button
                                            onClick={() => updateStatus(r.id, 'rejected')}
                                            disabled={processingId === r.id}
                                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-500 py-2 text-xs font-bold text-white transition-all hover:bg-rose-600 disabled:opacity-60"
                                        >
                                            <X size={14} /> رد و بازگشت وجه
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
