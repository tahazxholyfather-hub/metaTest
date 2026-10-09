import { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, AlertCircle, PenLine, FilePlus2 } from 'lucide-react';
import { adminApi } from '../lib/adminApi';

interface AdminWords {
    id: number;
    username: string;
    fullName?: string;
    role: string;
    status?: string;
    isSuper?: boolean;
    wordsInserted: number;
    wordsEdited: number;
    insertEvents: number;
    editEvents: number;
    questionsInserted: number;
    lastActivity?: string | null;
}

interface RecentEvent {
    id: number;
    username: string;
    fullName?: string;
    action: string;
    questionId: number | null;
    wordCount: number;
    source: string;
    createdAt?: string;
}

const fmt = (n: number) => Number(n || 0).toLocaleString();

export default function WordStats() {
    const [admins, setAdmins] = useState<AdminWords[]>([]);
    const [recent, setRecent] = useState<RecentEvent[]>([]);
    const [totals, setTotals] = useState({ wordsInserted: 0, wordsEdited: 0, questionsInserted: 0 });
    const [backfill, setBackfill] = useState<{ complete?: boolean; error?: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const retries = useRef(0);

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const res = await adminApi.wordStats();
            if (!res.success) throw new Error(res.message || 'بارگذاری فعالیت واژه‌ها ناموفق بود');
            setAdmins(res.admins || []);
            setRecent(res.recent || []);
            setTotals(res.totals || { wordsInserted: 0, wordsEdited: 0, questionsInserted: 0 });
            setBackfill(res.backfill || { complete: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'بارگذاری فعالیت واژه‌ها ناموفق بود');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    useEffect(() => {
        if (!backfill || backfill.complete || backfill.error) return;
        if (retries.current >= 8) return;
        retries.current += 1;
        const timer = setTimeout(() => { load(true); }, 700);
        return () => clearTimeout(timer);
    }, [backfill]);

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4 shadow-sm">
                <div>
                    <h1 className="text-sm font-bold">فعالیت واژه‌ها</h1>
                    <p className="text-xs text-[#86868b] mt-0.5 max-w-2xl">
                        واژه‌های افزوده‌شده از سوال‌هایی است که هر ادمین ساخته. واژه‌های ویرایش‌شده، کلماتی است که هنگام ذخیره متن سوال، گزینه‌ها یا پاسخ تشریحی اضافه یا حذف شده‌اند.
                    </p>
                </div>
                <button onClick={() => { retries.current = 0; load(); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746]">
                    <RefreshCw size={14} /> بروزرسانی
                </button>
            </div>

            {backfill && !backfill.complete && !backfill.error && (
                <div className="flex items-center gap-2 p-3 bg-[#e8f0fe] dark:bg-[#1a73e8]/10 text-[#1a73e8] rounded-xl text-xs font-semibold">
                    <Loader2 size={14} className="animate-spin" /> در حال فهرست‌کردن سوال‌هایی که قبل از این بخش ساخته شده‌اند.
                </div>
            )}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl text-xs font-semibold">
                    <AlertCircle size={14} /> {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-5">
                    <div className="flex items-center gap-2 text-[#86868b] text-[10px] font-bold uppercase tracking-wider"><FilePlus2 size={14} /> واژه‌های افزوده‌شده</div>
                    <p className="text-2xl font-bold mt-2">{fmt(totals.wordsInserted)}</p>
                </div>
                <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-5">
                    <div className="flex items-center gap-2 text-[#86868b] text-[10px] font-bold uppercase tracking-wider"><PenLine size={14} /> واژه‌های ویرایش‌شده</div>
                    <p className="text-2xl font-bold mt-2">{fmt(totals.wordsEdited)}</p>
                </div>
                <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-5">
                    <div className="text-[#86868b] text-[10px] font-bold uppercase tracking-wider">سوال‌های ساخته‌شده</div>
                    <p className="text-2xl font-bold mt-2">{fmt(totals.questionsInserted)}</p>
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
                                    <th className="text-start p-4">ادمین</th>
                                    <th className="text-start p-4">نقش</th>
                                    <th className="text-end p-4">سوال‌ها</th>
                                    <th className="text-end p-4">واژه افزوده‌شده</th>
                                    <th className="text-end p-4">واژه ویرایش‌شده</th>
                                    <th className="text-end p-4">ویرایش‌ها</th>
                                    <th className="text-start p-4">آخرین فعالیت</th>
                                </tr>
                            </thead>
                            <tbody>
                                {admins.map((admin) => (
                                    <tr key={admin.id} className="border-t border-[#dadce0] dark:border-[#333537]">
                                        <td className="p-4">
                                            <p className="font-semibold">{admin.fullName || admin.username}</p>
                                            <p className="text-[#86868b]">{admin.username}{admin.isSuper ? ' · اصلی' : ''}{admin.status === 'disabled' ? ' · غیرفعال' : ''}</p>
                                        </td>
                                        <td className="p-4">{admin.isSuper ? 'مدیر اصلی' : (admin.role === 'selector' ? 'سلکتور' : admin.role === 'typing' ? 'تایپ' : admin.role === 'admin' ? 'مدیر' : admin.role)}</td>
                                        <td className="p-4 text-end font-mono">{fmt(admin.questionsInserted)}</td>
                                        <td className="p-4 text-end font-mono">{fmt(admin.wordsInserted)}</td>
                                        <td className="p-4 text-end font-mono">{fmt(admin.wordsEdited)}</td>
                                        <td className="p-4 text-end font-mono">{fmt(admin.editEvents)}</td>
                                        <td className="p-4 text-[#86868b]">{admin.lastActivity ? new Date(admin.lastActivity).toLocaleString('fa-IR') : '—'}</td>
                                    </tr>
                                ))}
                                {admins.length === 0 && (
                                    <tr><td colSpan={7} className="p-8 text-center text-[#86868b]">ادمینی پیدا نشد.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 shadow-sm">
                <h2 className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-4">تغییرهای اخیر</h2>
                {recent.length === 0 ? (
                    <p className="text-xs text-[#86868b]">هنوز فعالیتی ثبت نشده.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {recent.map((event) => (
                            <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#f8f9fa] dark:bg-[#131314] text-xs">
                                <span className="font-semibold">{event.fullName || event.username || `admin #${event.id}`}</span>
                                <span className="text-[#86868b]">
                                    {event.action === 'insert' ? 'افزود' : 'ویرایش کرد'} {fmt(event.wordCount)} واژه
                                    {event.questionId ? ` · سوال ${event.questionId}` : ''}
                                    {event.source === 'backfill' ? ' · فهرست‌شده' : ''}
                                </span>
                                <span className="text-[#86868b]">{event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
