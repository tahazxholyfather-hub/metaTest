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
    questionsEdited?: number;
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

function tehranToday() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

function shiftIso(iso: string, days: number) {
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
    const nextDay = String(date.getUTCDate()).padStart(2, '0');
    return `${date.getUTCFullYear()}-${nextMonth}-${nextDay}`;
}

function persianDay(iso: string) {
    const [year, month, day] = iso.split('-').map(Number);
    if (!year || !month || !day) return '';
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(new Date(year, month - 1, day));
}

export default function WordStats() {
    const [admins, setAdmins] = useState<AdminWords[]>([]);
    const [recent, setRecent] = useState<RecentEvent[]>([]);
    const [totals, setTotals] = useState({ wordsInserted: 0, wordsEdited: 0, questionsInserted: 0, questionsEdited: 0 });
    const [backfill, setBackfill] = useState<{ complete?: boolean; error?: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const retries = useRef(0);
    const rangeRef = useRef({ from: '', to: '' });
    rangeRef.current = { from, to };

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const current = rangeRef.current;
            const res = await adminApi.wordStats({
                from: current.from || undefined,
                to: current.to || undefined,
            });
            if (!res.success) throw new Error(res.message || 'بارگذاری فعالیت واژه‌ها ناموفق بود');
            setAdmins(res.admins || []);
            setRecent(res.recent || []);
            setTotals(res.totals || { wordsInserted: 0, wordsEdited: 0, questionsInserted: 0, questionsEdited: 0 });
            setBackfill(res.backfill || { complete: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'بارگذاری فعالیت واژه‌ها ناموفق بود');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        retries.current = 0;
        load();
    }, [from, to]);

    const setRange = (nextFrom: string, nextTo: string) => {
        if (nextFrom && nextTo && nextFrom > nextTo) {
            setFrom(nextTo);
            setTo(nextFrom);
            return;
        }
        setFrom(nextFrom);
        setTo(nextTo);
    };

    const rangeLabel = from || to
        ? `از ${from ? persianDay(from) : 'ابتدا'} تا ${to ? persianDay(to) : 'امروز'}`
        : '';

    useEffect(() => {
        if (!backfill || backfill.complete || backfill.error) return;
        if (retries.current >= 8) return;
        retries.current += 1;
        const timer = setTimeout(() => { load(true); }, 700);
        return () => clearTimeout(timer);
    }, [backfill]);

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-wrap items-end justify-between gap-3 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4 shadow-sm">
                <div className="min-w-[16rem] flex-1">
                    <h1 className="text-sm font-bold">فعالیت واژه‌ها</h1>
                    <p className="text-xs text-[#86868b] mt-0.5 max-w-2xl">
                        واژه‌های افزوده‌شده از سوال‌هایی است که هر ادمین ساخته. «واژه ویرایش‌شده» اختلاف کلمه‌های متن، گزینه‌ها و پاسخ تشریحی در هر ذخیره است. «سوال ویرایش‌شده» تعداد سوال‌هایی است که آن ادمین آخرین ویرایششان را ثبت کرده.
                        {rangeLabel ? ` این اعداد ${rangeLabel} هستند و هر دو تاریخ داخل بازه‌اند.` : ''}
                    </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-[#86868b]">از تاریخ</span>
                        <input
                            type="date"
                            value={from}
                            max={to || undefined}
                            onChange={(event) => setRange(event.target.value, to)}
                            className="bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#1a73e8] dark:[color-scheme:dark]"
                        />
                        <span className="text-[10px] text-[#86868b] min-h-4">{from ? persianDay(from) : ''}</span>
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-[#86868b]">تا تاریخ</span>
                        <input
                            type="date"
                            value={to}
                            min={from || undefined}
                            onChange={(event) => setRange(from, event.target.value)}
                            className="bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#1a73e8] dark:[color-scheme:dark]"
                        />
                        <span className="text-[10px] text-[#86868b] min-h-4">{to ? persianDay(to) : ''}</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-1 pb-5">
                        {[
                            { label: 'امروز', days: 0 },
                            { label: '۷ روز', days: 6 },
                            { label: '۳۰ روز', days: 29 },
                        ].map((preset) => (
                            <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                    const today = tehranToday();
                                    setRange(shiftIso(today, -preset.days), today);
                                }}
                                className="px-2.5 py-2 rounded-xl text-[11px] font-bold text-[#1a73e8] bg-[#e8f0fe] dark:bg-[#1a73e8]/10"
                            >
                                {preset.label}
                            </button>
                        ))}
                        {(from || to) && (
                            <button
                                type="button"
                                onClick={() => setRange('', '')}
                                className="px-2.5 py-2 rounded-xl text-[11px] font-bold text-[#86868b]"
                            >
                                همه زمان‌ها
                            </button>
                        )}
                    </div>
                    <button onClick={() => { retries.current = 0; load(); }} className="mb-5 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746]">
                        <RefreshCw size={14} /> بروزرسانی
                    </button>
                </div>
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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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
                <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-5">
                    <div className="text-[#86868b] text-[10px] font-bold uppercase tracking-wider">سوال‌های ویرایش‌شده</div>
                    <p className="text-2xl font-bold mt-2">{fmt(totals.questionsEdited)}</p>
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
                                    <th className="text-end p-4">سوال ساخته‌شده</th>
                                    <th className="text-end p-4">سوال ویرایش‌شده</th>
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
                                        <td className="p-4 text-end font-mono">{fmt(admin.questionsEdited || 0)}</td>
                                        <td className="p-4 text-end font-mono">{fmt(admin.wordsInserted)}</td>
                                        <td className="p-4 text-end font-mono">{fmt(admin.wordsEdited)}</td>
                                        <td className="p-4 text-end font-mono">{fmt(admin.editEvents)}</td>
                                        <td className="p-4 text-[#86868b]">{admin.lastActivity ? new Date(admin.lastActivity).toLocaleString('fa-IR') : '—'}</td>
                                    </tr>
                                ))}
                                {admins.length === 0 && (
                                    <tr><td colSpan={8} className="p-8 text-center text-[#86868b]">ادمینی پیدا نشد.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 shadow-sm">
                <h2 className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-4">تغییرهای اخیر</h2>
                {recent.length === 0 ? (
                    <p className="text-xs text-[#86868b]">{rangeLabel ? 'در این بازه فعالیتی ثبت نشده.' : 'هنوز فعالیتی ثبت نشده.'}</p>
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
