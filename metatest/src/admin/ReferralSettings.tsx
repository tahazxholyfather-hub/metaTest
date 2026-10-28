import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { flowApi } from '../lib/authApi';
import { Loader2, Save, Percent, Coins, Banknote } from 'lucide-react';
import type { User } from './AuthView';

interface Props {
    user: User;
}

const REWARD_TYPES = [
    { id: 'percent', label: 'درصد از مبلغ پکیج', icon: Percent },
    { id: 'fixed', label: 'مبلغ ثابت (تومان)', icon: Banknote },
    { id: 'token', label: 'توکن ثابت', icon: Coins },
] as const;

export default function ReferralSettings({ user }: Props) {
    const [rewardType, setRewardType] = useState<'percent' | 'fixed' | 'token'>('percent');
    const [rewardPercent, setRewardPercent] = useState('30');
    const [rewardFixedAmount, setRewardFixedAmount] = useState('0');
    const [rewardTokenAmount, setRewardTokenAmount] = useState('0');
    const [isActive, setIsActive] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        try {
            const res: any = await flowApi.dispatch('Admin_get_referral_settings');
            if (res?.success && res?.data) {
                setRewardType(res.data.rewardType || 'percent');
                setRewardPercent(String(res.data.rewardPercent ?? 30));
                setRewardFixedAmount(String(res.data.rewardFixedAmount ?? 0));
                setRewardTokenAmount(String(res.data.rewardTokenAmount ?? 0));
                setIsActive(!!res.data.isActive);
            }
        } catch {
            toast.error('خطا در دریافت تنظیمات دعوت');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res: any = await flowApi.dispatch('Admin_update_referral_settings', {
                rewardType,
                rewardPercent: Number(rewardPercent) || 0,
                rewardFixedAmount: Number(rewardFixedAmount) || 0,
                rewardTokenAmount: Number(rewardTokenAmount) || 0,
                isActive,
            });
            if (res?.success) {
                toast.success('تنظیمات دعوت ذخیره شد.');
            } else {
                toast.error(res?.message || 'خطا در ذخیره تنظیمات');
            }
        } catch {
            toast.error('خطا در ارتباط با سرور');
        } finally {
            setSaving(false);
        }
    };

    const inputClass =
        'w-full rounded-xl border border-[#dadce0] dark:border-[#333537] bg-white dark:bg-[#131314] px-4 py-3 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#1a73e8] focus:ring-4 focus:ring-[#1a73e8]/10 transition-all';

    return (
        <div className="max-w-2xl space-y-6" dir="rtl">
            <div className="rounded-2xl border border-[#dadce0] dark:border-[#333537] bg-white dark:bg-[#1e1f20] p-6">
                <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">تنظیمات پاداش دعوت</h2>
                <p className="text-xs text-[#86868b] mt-1">
                    پاداشی که به معرف‌ها (دعوت‌کنندگان) بابت اولین خرید دعوت‌شده‌ها پرداخت می‌شود را تعیین کنید.
                </p>

                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-[#86868b]">
                        <Loader2 size={22} className="animate-spin text-[#1a73e8]" />
                        <span className="text-xs font-bold">در حال دریافت تنظیمات...</span>
                    </div>
                ) : (
                    <>
                        {/* Toggle active */}
                        <label className="mt-6 flex items-center justify-between rounded-xl border border-[#dadce0] dark:border-[#333537] px-4 py-3 cursor-pointer">
                            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">فعال‌سازی پاداش دعوت</span>
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="h-5 w-5 accent-[#1a73e8]"
                            />
                        </label>

                        {/* Reward type */}
                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {REWARD_TYPES.map((t) => {
                                const Icon = t.icon;
                                const active = rewardType === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setRewardType(t.id)}
                                        className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-xs font-bold transition-all ${
                                            active
                                                ? 'border-[#1a73e8] bg-[#e8f0fe] dark:bg-[#2d3748] text-[#1a73e8] dark:text-[#8ab4f8]'
                                                : 'border-[#dadce0] dark:border-[#333537] text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f1f3f4] dark:hover:bg-[#333537]'
                                        }`}
                                    >
                                        <Icon size={20} />
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Fields */}
                        <div className="mt-5 space-y-4">
                            {rewardType === 'percent' && (
                                <div>
                                    <label className="text-xs font-bold text-[#86868b]">درصد پاداش (٪)</label>
                                    <input
                                        type="number"
                                        value={rewardPercent}
                                        onChange={(e) => setRewardPercent(e.target.value)}
                                        className={`${inputClass} mt-1`}
                                    />
                                </div>
                            )}
                            {rewardType === 'fixed' && (
                                <div>
                                    <label className="text-xs font-bold text-[#86868b]">مبلغ ثابت (تومان)</label>
                                    <input
                                        type="number"
                                        value={rewardFixedAmount}
                                        onChange={(e) => setRewardFixedAmount(e.target.value)}
                                        className={`${inputClass} mt-1`}
                                    />
                                </div>
                            )}
                            {rewardType === 'token' && (
                                <div>
                                    <label className="text-xs font-bold text-[#86868b]">تعداد توکن ثابت</label>
                                    <input
                                        type="number"
                                        value={rewardTokenAmount}
                                        onChange={(e) => setRewardTokenAmount(e.target.value)}
                                        className={`${inputClass} mt-1`}
                                    />
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a73e8] py-3.5 text-sm font-bold text-white transition-all hover:bg-[#1557b0] disabled:opacity-60"
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            ذخیره تنظیمات
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
