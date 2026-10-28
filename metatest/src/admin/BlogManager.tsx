import { useEffect, useState } from 'react';
import { Newspaper, Loader2, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { adminApi } from '../lib/adminApi';

interface Post {
    id: number;
    title: string;
    slug: string;
    excerpt: string;
    body: string;
    coverUrl: string | null;
    category: string;
    featured: boolean;
    published: boolean;
}

const EMPTY = { id: 0, title: '', slug: '', excerpt: '', body: '', coverUrl: '', category: 'study', featured: false, published: false };

export default function BlogManager() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [form, setForm] = useState(EMPTY);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminApi.listBlog();
            setPosts((res.data || []) as Post[]);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'دریافت مطالب ممکن نشد');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const save = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await adminApi.saveBlog({
                ...form,
                id: form.id || undefined,
                coverUrl: form.coverUrl,
            });
            setSuccess(res.message || 'ذخیره شد');
            setForm(EMPTY);
            await load();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'ذخیره ممکن نشد');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (post: Post) => {
        if (!window.confirm(`حذف «${post.title}»؟`)) return;
        try {
            await adminApi.deleteBlog(post.id);
            if (form.id === post.id) setForm(EMPTY);
            await load();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'حذف ممکن نشد');
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full" dir="rtl">
            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4 shadow-sm">
                <h1 className="text-sm font-bold flex items-center gap-2"><Newspaper size={16} /> بلاگ آموزشی</h1>
                <p className="text-xs text-[#86868b] mt-1">مدیر اصلی همیشه این بخش را دارد. بقیه ادمین‌ها فقط وقتی در «دسترسی‌ها» بلاگ آموزشی برایشان روشن شده باشد می‌توانند مطلب بسازند. مطلب منتشرشده در لندینگ و /blog دیده می‌شود.</p>
            </div>
            {error && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold"><AlertCircle size={14} /> {error}</div>}
            {success && <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-xl text-xs font-semibold"><CheckCircle2 size={14} /> {success}</div>}
            <div className="grid gap-3 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-5">
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان" className="rounded-xl border border-[#dadce0] dark:border-[#444746] bg-transparent px-3 py-2 text-sm" />
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="نامک (اختیاری)" className="rounded-xl border border-[#dadce0] dark:border-[#444746] bg-transparent px-3 py-2 text-sm" />
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-xl border border-[#dadce0] dark:border-[#444746] bg-transparent px-3 py-2 text-sm">
                    <option value="study">روش مطالعه</option>
                    <option value="exam">آزمون</option>
                    <option value="planning">برنامه‌ریزی</option>
                    <option value="ai">معلم هوشمند</option>
                </select>
                <input value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder="خلاصه" className="rounded-xl border border-[#dadce0] dark:border-[#444746] bg-transparent px-3 py-2 text-sm" />
                <input value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} placeholder="آدرس تصویر https://" className="rounded-xl border border-[#dadce0] dark:border-[#444746] bg-transparent px-3 py-2 text-sm" />
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="متن" rows={8} className="rounded-xl border border-[#dadce0] dark:border-[#444746] bg-transparent px-3 py-2 text-sm" />
                <label className="text-xs font-bold flex items-center gap-2"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> منتشر شود</label>
                <label className="text-xs font-bold flex items-center gap-2"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> مطلب ویژه</label>
                <div className="flex gap-2">
                    <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1a73e8] text-white disabled:opacity-60">{form.id ? 'به‌روزرسانی' : 'ساخت مطلب'}</button>
                    <button onClick={() => setForm(EMPTY)} className="px-4 py-2 rounded-xl text-xs font-bold border border-[#dadce0] dark:border-[#444746]">پاک کردن فرم</button>
                </div>
            </div>
            {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1a73e8]" /></div> : (
                <div className="flex flex-col gap-3">
                    {posts.map((post) => (
                        <div key={post.id} className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4">
                            <div>
                                <p className="text-sm font-bold">{post.title}</p>
                                <p className="text-[11px] text-[#86868b]">{post.published ? 'منتشر شده' : 'پیش‌نویس'} · {post.category}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setForm({ ...post, coverUrl: post.coverUrl || '' })} className="text-xs font-bold text-[#1a73e8]">ویرایش</button>
                                <button onClick={() => remove(post)} className="text-red-500"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                    {!posts.length && <p className="text-xs text-[#86868b]">هنوز مطلبی نیست.</p>}
                </div>
            )}
        </div>
    );
}
