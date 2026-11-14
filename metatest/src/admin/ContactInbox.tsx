import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Inbox, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { adminApi } from '../lib/adminApi';

interface ContactMessage {
    id: number;
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
    status: string;
    createdAt: string | null;
}

const STATUSES = [
    { id: 'all', title: 'همه' },
    { id: 'new', title: 'جدید' },
    { id: 'read', title: 'خوانده‌شده' },
    { id: 'archived', title: 'بایگانی' },
];

export default function ContactInbox() {
    const [messages, setMessages] = useState<ContactMessage[]>([]);
    const [summary, setSummary] = useState({ new: 0, read: 0, archived: 0 });
    const [status, setStatus] = useState('new');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const load = async (nextStatus = status) => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminApi.listContactMessages(nextStatus);
            if (!res.success) throw new Error(res.message || 'بارگذاری پیام‌ها ناموفق بود');
            setMessages((res.messages || []) as ContactMessage[]);
            setSummary(res.summary || { new: 0, read: 0, archived: 0 });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'بارگذاری پیام‌ها ناموفق بود');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load('new');
        // Initial inbox view is the unread queue.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!success) return undefined;
        const timer = setTimeout(() => setSuccess(null), 3000);
        return () => clearTimeout(timer);
    }, [success]);

    const changeStatus = async (message: ContactMessage, next: string) => {
        const res = await adminApi.updateContactMessage(message.id, next);
        if (!res.success) {
            setError(res.message || 'به‌روزرسانی پیام ناموفق بود');
            return;
        }
        setSuccess('وضعیت پیام ذخیره شد');
        load();
    };

    const remove = async (message: ContactMessage) => {
        const res = await adminApi.deleteContactMessage(message.id);
        if (!res.success) {
            setError(res.message || 'حذف پیام ناموفق بود');
            return;
        }
        setMessages((prev) => prev.filter((row) => row.id !== message.id));
        setSuccess('پیام حذف شد');
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4 shadow-sm">
                <div>
                    <h1 className="text-sm font-bold flex items-center gap-2"><Inbox size={16} /> پیام‌های تماس</h1>
                    <p className="text-xs text-[#86868b] mt-0.5">
                        پیام‌های فرم تماس لندینگ اینجاست. {summary.new.toLocaleString('fa-IR')} پیام جدید، {summary.read.toLocaleString('fa-IR')} خوانده‌شده.
                    </p>
                </div>
                <button onClick={() => load()} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746]">
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

            <div className="flex flex-wrap items-center bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-full p-1 w-fit">
                {STATUSES.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => { setStatus(item.id); load(item.id); }}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${status === item.id ? 'bg-[#1a73e8] text-white' : 'text-[#86868b]'}`}
                    >
                        {item.title}
                    </button>
                ))}
            </div>

            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1a73e8]" /></div>
                ) : messages.length === 0 ? (
                    <p className="text-center text-sm text-[#86868b] py-16">پیامی در این فهرست نیست.</p>
                ) : (
                    <div className="flex flex-col">
                        {messages.map((message) => (
                            <article key={message.id} className="p-5 border-b border-[#dadce0] dark:border-[#333537]">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold">
                                            #{message.id} · {message.subject}
                                        </p>
                                        <p className="text-[11px] text-[#86868b] mt-1">
                                            {message.name}
                                            {message.phone ? ` · ${message.phone}` : ''}
                                            {message.email ? ` · ${message.email}` : ''}
                                            {message.createdAt ? ` · ${new Date(message.createdAt).toLocaleString('fa-IR')}` : ''}
                                        </p>
                                        <p className="text-sm mt-2 whitespace-pre-wrap">{message.message}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={message.status}
                                            onChange={(event) => changeStatus(message, event.target.value)}
                                            className="admin-input"
                                            aria-label="وضعیت پیام"
                                        >
                                            {STATUSES.filter((item) => item.id !== 'all').map((item) => (
                                                <option key={item.id} value={item.id}>{item.title}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => remove(message)}
                                            className="p-3 rounded-xl text-red-500 bg-red-50 dark:bg-red-500/10"
                                            aria-label="حذف پیام"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
