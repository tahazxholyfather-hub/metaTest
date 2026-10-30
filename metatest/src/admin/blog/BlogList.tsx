import { Loader2, Newspaper, Plus, Trash2 } from 'lucide-react';
import { fieldClass, type BlogPost } from './types';

export function BlogList({
    posts,
    query,
    loading,
    error,
    success,
    onQuery,
    onCreate,
    onEdit,
    onDelete,
}: {
    posts: BlogPost[];
    query: string;
    loading: boolean;
    error: string | null;
    success: string | null;
    onQuery: (value: string) => void;
    onCreate: () => void;
    onEdit: (post: BlogPost) => void;
    onDelete: (post: BlogPost) => void;
}) {
    const visible = posts.filter((post) => !query || post.title.includes(query));
    return (
        <div className="flex flex-col gap-4 w-full" dir="rtl">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4">
                <div>
                    <h1 className="text-sm font-bold flex items-center gap-2"><Newspaper size={16} /> بلاگ آموزشی</h1>
                    <p className="text-xs text-[#86868b] mt-1">مقاله را با عنوان، خلاصه و بلوک‌های محتوا بساز. تصویر و ویدیو را با انتخاب فایل بگذار. بعد از انتشار روی لندینگ دیده می‌شود.</p>
                </div>
                <button onClick={onCreate} className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1a73e8] text-white flex items-center gap-1"><Plus size={14} /> مقاله جدید</button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            {success && <p className="text-xs text-green-700">{success}</p>}
            <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="جستجو در عنوان…" className={fieldClass} />
            {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1a73e8]" /></div> : (
                <div className="flex flex-col gap-2">
                    {visible.map((post) => (
                        <div key={post.id} className="flex items-center justify-between gap-3 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl px-4 py-3">
                            <div>
                                <p className="text-sm font-bold">{post.title}</p>
                                <p className="text-[11px] text-[#86868b]">{post.published ? 'منتشر شده' : 'پیش‌نویس'}{post.featured ? ' · ویژه' : ''}</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => onEdit(post)} className="text-xs font-bold text-[#1a73e8]">ویرایش</button>
                                <button onClick={() => onDelete(post)} className="text-red-500"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                    {!visible.length && <p className="text-xs text-[#86868b]">مطلبی نیست.</p>}
                </div>
            )}
        </div>
    );
}
