import { useEffect, useState } from 'react';
import { AlertCircle, Bell, Loader2, Send } from 'lucide-react';
import { adminApi } from '../lib/adminApi';

interface PlanOption {
    id: string;
    name: string;
}

interface Announcement {
    id: number;
    title: string;
    body: string;
    audience: 'all' | 'subscribers' | 'plan';
    planId?: string | null;
    planName?: string | null;
    recipientCount: number;
    createdAt?: string;
    adminUsername?: string;
}

const audienceLabel = (item: Announcement) => {
    if (item.audience === 'subscribers') return 'فقط اشتراک‌دارها';
    if (item.audience === 'plan') return item.planName || item.planId || 'یک پلن';
    return 'همه کاربران';
};

export default function AnnouncementsManager() {
    const [plans, setPlans] = useState<PlanOption[]>([]);
    const [items, setItems] = useState<Announcement[]>([]);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [audience, setAudience] = useState<'all' | 'subscribers' | 'plan'>('all');
    const [planId, setPlanId] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminApi.listAnnouncements();
            if (!res.success) throw new Error(res.message || 'بارگذاری اعلان‌ها ناموفق بود');
            setItems(res.announcements || []);
            setPlans(res.plans || []);
            setPlanId((current) => current || res.plans?.[0]?.id || '');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'بارگذاری اعلان‌ها ناموفق بود');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const send = async () => {
        setSending(true);
        setError(null);
        setNotice(null);
        try {
            const res = await adminApi.sendAnnouncement({
                title,
                body,
                audience,
                planId: audience === 'plan' ? planId : null,
            });
            if (!res.success) throw new Error(res.message || 'ارسال اعلان ناموفق بود');
            setTitle('');
            setBody('');
            setNotice(res.message || 'اعلان فرستاده شد.');
            setItems(res.announcements || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'ارسال اعلان ناموفق بود');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4 shadow-sm">
                <h1 className="text-sm font-bold flex items-center gap-2"><Bell size={16} /> اعلان‌های سیستم</h1>
                <p className="text-xs text-[#86868b] mt-1 max-w-2xl">
                    پیام از زنگوله داشبورد برای کاربران می‌رود. می‌توانی همه را مخاطب کنی، فقط کسانی که اشتراک فعال دارند، یا فقط یک پلن مشخص.
                </p>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl text-xs font-semibold">
                    <AlertCircle size={14} /> {error}
                </div>
            )}
            {notice && (
                <div className="p-3 bg-[#e8f0fe] dark:bg-[#1a73e8]/10 text-[#1a73e8] rounded-xl text-xs font-semibold">{notice}</div>
            )}

            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 shadow-sm flex flex-col gap-4">
                <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={255}
                    placeholder="عنوان اعلان"
                    className="w-full rounded-xl border border-[#dadce0] dark:border-[#444746] bg-[#f8f9fa] dark:bg-[#131314] px-4 py-3 text-sm"
                />
                <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    maxLength={4000}
                    rows={4}
                    placeholder="متن پیام"
                    className="w-full rounded-xl border border-[#dadce0] dark:border-[#444746] bg-[#f8f9fa] dark:bg-[#131314] px-4 py-3 text-sm"
                />
                <div className="flex flex-wrap gap-3">
                    <select
                        value={audience}
                        onChange={(event) => setAudience(event.target.value as 'all' | 'subscribers' | 'plan')}
                        className="rounded-xl border border-[#dadce0] dark:border-[#444746] bg-[#f8f9fa] dark:bg-[#131314] px-4 py-3 text-xs"
                    >
                        <option value="all">همه کاربران</option>
                        <option value="subscribers">فقط اشتراک‌دارها</option>
                        <option value="plan">فقط یک پلن</option>
                    </select>
                    {audience === 'plan' && (
                        <select
                            value={planId}
                            onChange={(event) => setPlanId(event.target.value)}
                            className="rounded-xl border border-[#dadce0] dark:border-[#444746] bg-[#f8f9fa] dark:bg-[#131314] px-4 py-3 text-xs"
                        >
                            {plans.map((plan) => (
                                <option key={plan.id} value={plan.id}>{plan.name}</option>
                            ))}
                        </select>
                    )}
                    <button
                        type="button"
                        onClick={send}
                        disabled={sending || !title.trim() || !body.trim() || (audience === 'plan' && !planId)}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-[#1a73e8] text-white disabled:opacity-50"
                    >
                        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        ارسال
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1a73e8]" /></div>
                ) : items.length === 0 ? (
                    <p className="p-8 text-center text-xs text-[#86868b]">هنوز اعلانی فرستاده نشده.</p>
                ) : (
                    <div className="flex flex-col">
                        {items.map((item) => (
                            <div key={item.id} className="border-t first:border-t-0 border-[#dadce0] dark:border-[#333537] p-4 flex flex-col gap-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-bold">{item.title}</p>
                                    <span className="text-[10px] text-[#86868b]">
                                        {audienceLabel(item)} · {Number(item.recipientCount || 0).toLocaleString('fa-IR')} گیرنده
                                    </span>
                                </div>
                                <p className="text-xs text-[#5f6368] dark:text-[#c4c7c5] whitespace-pre-wrap">{item.body}</p>
                                <p className="text-[10px] text-[#86868b]">
                                    {item.adminUsername ? `${item.adminUsername} · ` : ''}
                                    {item.createdAt ? new Date(item.createdAt).toLocaleString('fa-IR') : ''}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
