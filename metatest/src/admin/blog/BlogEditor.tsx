import { ContentBlocks } from './ContentBlocks';
import { MediaDrop } from './MediaDrop';
import { BLOG_CATEGORIES, fieldClass, type BlogDraft } from './types';

export function BlogEditor({
    form,
    saving,
    error,
    onChange,
    onBack,
    onSave,
}: {
    form: BlogDraft;
    saving: boolean;
    error: string | null;
    onChange: (form: BlogDraft) => void;
    onBack: () => void;
    onSave: () => void;
}) {
    return (
        <div className="flex flex-col gap-4 w-full max-w-4xl" dir="rtl">
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="text-xs font-bold text-[#1a73e8]">بازگشت به فهرست</button>
                <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1a73e8] text-white disabled:opacity-60">{saving ? 'در حال ذخیره…' : 'ذخیره مقاله'}</button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <section className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[1.5rem] p-5 flex flex-col gap-3">
                <h2 className="text-sm font-bold">اطلاعات پایه</h2>
                <label className="text-xs font-bold flex flex-col gap-1">عنوان مقاله
                    <input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} className={fieldClass} placeholder="عنوان مقاله" />
                </label>
                <div className="grid md:grid-cols-2 gap-3">
                    <label className="text-xs font-bold flex flex-col gap-1">نامک
                        <input value={form.slug} onChange={(event) => onChange({ ...form, slug: event.target.value })} className={fieldClass} placeholder="خالی بماند تا از عنوان ساخته شود" />
                    </label>
                    <label className="text-xs font-bold flex flex-col gap-1">دسته‌بندی
                        <select value={form.category} onChange={(event) => onChange({ ...form, category: event.target.value })} className={fieldClass}>
                            {BLOG_CATEGORIES.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                    </label>
                    <label className="text-xs font-bold flex flex-col gap-1">نویسنده
                        <input value={form.author} onChange={(event) => onChange({ ...form, author: event.target.value })} className={fieldClass} />
                    </label>
                    <label className="text-xs font-bold flex flex-col gap-1">زمان مطالعه
                        <input value={form.readTime} onChange={(event) => onChange({ ...form, readTime: event.target.value })} className={fieldClass} placeholder="۵ دقیقه" />
                    </label>
                </div>
                <div className="text-xs font-bold flex flex-col gap-1">تصویر کاور
                    <MediaDrop kind="image" value={form.coverUrl} onChange={(coverUrl) => onChange({ ...form, coverUrl })} />
                </div>
                <label className="text-xs font-bold flex flex-col gap-1">خلاصه
                    <textarea value={form.excerpt} onChange={(event) => onChange({ ...form, excerpt: event.target.value })} rows={3} className={fieldClass} />
                </label>
                <div className="flex gap-4 text-xs font-bold">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={form.featured} onChange={(event) => onChange({ ...form, featured: event.target.checked })} /> مقاله ویژه</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={form.published} onChange={(event) => onChange({ ...form, published: event.target.checked })} /> نمایش در سایت</label>
                </div>
            </section>
            <ContentBlocks blocks={form.content} onChange={(content) => onChange({ ...form, content })} />
        </div>
    );
}
