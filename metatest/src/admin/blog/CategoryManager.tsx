import { useState } from 'react';
import { adminApi } from '../../lib/adminApi';

export function CategoryManager({
    categories,
    onChange,
}: {
    categories: { slug: string; name: string }[];
    onChange: (categories: { slug: string; name: string }[]) => void;
}) {
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const add = async () => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setBusy(true);
        setError(null);
        try {
            const res = await adminApi.createBlogCategory(trimmed);
            onChange(res.data || []);
            setName('');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'افزودن دسته ممکن نشد');
        } finally {
            setBusy(false);
        }
    };

    const remove = async (slug: string) => {
        setBusy(true);
        setError(null);
        try {
            const impact = await adminApi.blogCategoryImpact(slug);
            const info = impact.data;
            const message = `با حذف «${info.name}»، مقاله‌هایی که فقط همین دسته را دارند حذف می‌شوند (${info.onlyCount.toLocaleString('fa-IR')} مقاله). مقاله‌هایی که دستهٔ دیگری هم دارند می‌مانند (${info.sharedCount.toLocaleString('fa-IR')} مقاله). ادامه می‌دهید؟`;
            if (!window.confirm(message)) return;
            const res = await adminApi.deleteBlogCategory(slug);
            onChange(res.data || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'حذف دسته ممکن نشد');
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4 flex flex-col gap-3" dir="rtl">
            <h2 className="text-sm font-bold">دسته‌بندی‌ها</h2>
            <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                    <span key={cat.slug} className="inline-flex items-center gap-2 rounded-full border border-[#dadce0] dark:border-[#444746] px-3 py-1 text-xs font-bold">
                        {cat.name}
                        <button type="button" disabled={busy} onClick={() => { void remove(cat.slug); }} className="text-red-600">×</button>
                    </span>
                ))}
            </div>
            <div className="flex gap-2">
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="نام دسته جدید" className="rounded-xl border border-[#dadce0] dark:border-[#444746] bg-transparent px-3 py-2 text-sm flex-1" />
                <button type="button" disabled={busy} onClick={() => { void add(); }} className="px-3 py-2 rounded-xl text-xs font-bold bg-[#1a73e8] text-white disabled:opacity-60">افزودن</button>
            </div>
            {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
        </section>
    );
}
