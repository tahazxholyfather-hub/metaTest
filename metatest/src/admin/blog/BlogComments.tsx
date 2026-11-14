import { useEffect, useState } from 'react';
import { Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { fieldClass } from './types';

export type BlogComment = {
    id: number;
    postId: number;
    name: string;
    body: string;
    status: 'pending' | 'approved';
    source: 'visitor' | 'admin';
    createdAt: string | null;
    postTitle?: string;
    postSlug?: string;
};

function when(value: string | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function BlogComments({
    postId,
    postTitle,
    onBack,
}: {
    postId: number;
    postTitle: string;
    onBack: () => void;
}) {
    const [comments, setComments] = useState<BlogComment[]>([]);
    const [status, setStatus] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [body, setBody] = useState('');
    const [saving, setSaving] = useState(false);

    const load = async (nextStatus = status) => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminApi.listBlogComments({ postId, status: nextStatus === 'all' ? undefined : nextStatus });
            setComments((res.comments || []) as BlogComment[]);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'دریافت دیدگاه‌ها ممکن نشد');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load('all'); }, [postId]);

    const approve = async (comment: BlogComment) => {
        try {
            await adminApi.updateBlogComment(comment.id, 'approved');
            setSuccess('دیدگاه تأیید شد و در صفحه مطلب دیده می‌شود.');
            await load();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'تأیید ممکن نشد');
        }
    };

    const remove = async (comment: BlogComment) => {
        if (!window.confirm('این دیدگاه حذف شود؟')) return;
        try {
            await adminApi.deleteBlogComment(comment.id);
            setComments((current) => current.filter((item) => item.id !== comment.id));
            setSuccess('دیدگاه حذف شد.');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'حذف ممکن نشد');
        }
    };

    const add = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            await adminApi.createBlogComment(postId, { name, body });
            setName('');
            setBody('');
            setSuccess('دیدگاه شما روی همین مطلب منتشر شد.');
            setStatus('all');
            await load('all');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'ثبت دیدگاه ممکن نشد');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 w-full" dir="rtl">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4">
                <div>
                    <h1 className="text-sm font-bold">نظرات «{postTitle}»</h1>
                    <p className="text-xs text-[#86868b] mt-1">دیدگاه بازدیدکننده تا تأیید شما روی مطلب دیده نمی‌شود. دیدگاهی که اینجا می‌نویسید همان لحظه منتشر می‌شود.</p>
                </div>
                <button type="button" onClick={onBack} className="text-xs font-bold text-[#1a73e8]">بازگشت به مطالب</button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            {success && <p className="text-xs text-green-700">{success}</p>}
            <form
                className="grid gap-3 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4"
                onSubmit={(event) => { event.preventDefault(); void add(); }}
            >
                <p className="text-xs font-bold">افزودن دیدگاه</p>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="نام" className={fieldClass} maxLength={80} />
                <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="متن دیدگاه" className={fieldClass} rows={3} maxLength={2000} />
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1a73e8] text-white flex items-center gap-1 w-fit disabled:opacity-50">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    ثبت دیدگاه
                </button>
            </form>
            <div className="flex gap-2">
                {[
                    { id: 'all', title: 'همه' },
                    { id: 'pending', title: 'در انتظار تأیید' },
                    { id: 'approved', title: 'منتشرشده' },
                ].map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => { setStatus(item.id); void load(item.id); }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border ${status === item.id ? 'bg-[#1a73e8] text-white border-[#1a73e8]' : 'border-[#dadce0] dark:border-[#333537]'}`}
                    >
                        {item.title}
                    </button>
                ))}
            </div>
            {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1a73e8]" /></div> : (
                <div className="flex flex-col gap-2">
                    {comments.map((comment) => (
                        <article key={comment.id} className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold">{comment.name}</p>
                                    <p className="text-[11px] text-[#86868b] mt-1">
                                        {comment.status === 'approved' ? 'منتشر شده' : 'در انتظار تأیید'}
                                        {comment.source === 'admin' ? ' · نوشته ادمین' : ' · بازدیدکننده'}
                                        {comment.createdAt ? ` · ${when(comment.createdAt)}` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {comment.status !== 'approved' && (
                                        <button type="button" onClick={() => { void approve(comment); }} className="text-xs font-bold text-[#1a73e8] flex items-center gap-1">
                                            <Check size={14} /> تأیید
                                        </button>
                                    )}
                                    <button type="button" onClick={() => { void remove(comment); }} className="text-red-500" aria-label="حذف دیدگاه">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm leading-7 mt-2 whitespace-pre-wrap">{comment.body}</p>
                        </article>
                    ))}
                    {!comments.length && <p className="text-xs text-[#86868b]">برای این مطلب دیدگاهی نیست.</p>}
                </div>
            )}
        </div>
    );
}
