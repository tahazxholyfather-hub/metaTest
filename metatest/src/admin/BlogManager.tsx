import { useEffect, useRef, useState } from 'react';
import { AlignLeft, Bold, Film, Heading, Image as ImageIcon, Italic, List, Loader2, Newspaper, Plus, Trash2, Underline, X } from 'lucide-react';
import { adminApi } from '../lib/adminApi';

type Block =
    | { type: 'heading'; level: number; text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'list'; items: string[] }
    | { type: 'image'; url: string; alt: string; caption: string }
    | { type: 'video'; url: string; caption: string };

interface Post {
    id: number;
    title: string;
    slug: string;
    excerpt: string;
    body: string;
    content?: Block[];
    coverUrl: string | null;
    author?: string;
    category: string;
    featured: boolean;
    published: boolean;
    readTime?: string;
}

const EMPTY = {
    id: 0, title: '', slug: '', excerpt: '', coverUrl: '', author: 'تیم متاتست',
    category: 'study', featured: false, published: true, readTime: '', content: [] as Block[],
};

const CATS = [
    { id: 'study', name: 'روش مطالعه' },
    { id: 'exam', name: 'آزمون' },
    { id: 'planning', name: 'برنامه‌ریزی' },
    { id: 'ai', name: 'معلم هوشمند' },
];

const BLOCKS = [
    { type: 'heading', label: 'تیتر', icon: Heading },
    { type: 'paragraph', label: 'متن', icon: AlignLeft },
    { type: 'list', label: 'لیست', icon: List },
    { type: 'image', label: 'تصویر', icon: ImageIcon },
    { type: 'video', label: 'ویدیو', icon: Film },
] as const;

function emptyBlock(type: string): Block {
    if (type === 'heading') return { type: 'heading', level: 2, text: '' };
    if (type === 'list') return { type: 'list', items: [''] };
    if (type === 'image') return { type: 'image', url: '', alt: '', caption: '' };
    if (type === 'video') return { type: 'video', url: '', caption: '' };
    return { type: 'paragraph', text: '' };
}

function RichText({ value, onChange }: { value: string; onChange: (html: string) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (ref.current && document.activeElement !== ref.current && ref.current.innerHTML !== (value || '')) {
            ref.current.innerHTML = value || '';
        }
    }, [value]);
    const exec = (command: string) => {
        ref.current?.focus();
        document.execCommand(command);
        onChange(ref.current?.innerHTML || '');
    };
    return (
        <div className="rounded-xl border border-[#dadce0] dark:border-[#444746] overflow-hidden">
            <div className="flex gap-1 p-1 border-b border-[#dadce0] dark:border-[#333537] bg-[#f8f9fa] dark:bg-[#131314]">
                <button type="button" onClick={() => exec('bold')} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#1e1f20]"><Bold size={14} /></button>
                <button type="button" onClick={() => exec('italic')} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#1e1f20]"><Italic size={14} /></button>
                <button type="button" onClick={() => exec('underline')} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#1e1f20]"><Underline size={14} /></button>
            </div>
            <div
                ref={ref}
                contentEditable
                dir="rtl"
                className="min-h-28 px-3 py-2 text-sm outline-none"
                onInput={() => onChange(ref.current?.innerHTML || '')}
                data-placeholder="متن پاراگراف…"
            />
        </div>
    );
}

const field = 'rounded-xl border border-[#dadce0] dark:border-[#444746] bg-transparent px-3 py-2 text-sm w-full';

export default function BlogManager() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [form, setForm] = useState(EMPTY);
    const [editing, setEditing] = useState(false);
    const [query, setQuery] = useState('');
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

    const openNew = () => { setForm(EMPTY); setEditing(true); setSuccess(null); setError(null); };
    const openEdit = (post: Post) => {
        setForm({
            ...EMPTY,
            ...post,
            coverUrl: post.coverUrl || '',
            author: post.author || 'تیم متاتست',
            readTime: post.readTime || '',
            content: Array.isArray(post.content) && post.content.length
                ? post.content
                : (post.body ? [{ type: 'paragraph', text: post.body.replace(/\n/g, '<br>') }] : []),
        });
        setEditing(true);
        setSuccess(null);
        setError(null);
    };

    const setBlock = (index: number, block: Block) => {
        setForm((current) => ({ ...current, content: current.content.map((item, i) => i === index ? block : item) }));
    };
    const move = (index: number, dir: -1 | 1) => {
        setForm((current) => {
            const next = [...current.content];
            const target = index + dir;
            if (target < 0 || target >= next.length) return current;
            [next[index], next[target]] = [next[target], next[index]];
            return { ...current, content: next };
        });
    };

    const save = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await adminApi.saveBlog({
                ...form,
                id: form.id || undefined,
                coverUrl: form.coverUrl,
                content: form.content,
            });
            setSuccess(res.message || 'ذخیره شد');
            setEditing(false);
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
            await load();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'حذف ممکن نشد');
        }
    };

    const visible = posts.filter((post) => !query || post.title.includes(query));

    if (!editing) {
        return (
            <div className="flex flex-col gap-4 w-full" dir="rtl">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4">
                    <div>
                        <h1 className="text-sm font-bold flex items-center gap-2"><Newspaper size={16} /> بلاگ آموزشی</h1>
                        <p className="text-xs text-[#86868b] mt-1">مقاله را با عنوان، خلاصه و بلوک‌های محتوا بساز. بعد از انتشار روی لندینگ دیده می‌شود.</p>
                    </div>
                    <button onClick={openNew} className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1a73e8] text-white flex items-center gap-1"><Plus size={14} /> مقاله جدید</button>
                </div>
                {error && <p className="text-xs text-red-600">{error}</p>}
                {success && <p className="text-xs text-green-700">{success}</p>}
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجو در عنوان…" className={field} />
                {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1a73e8]" /></div> : (
                    <div className="flex flex-col gap-2">
                        {visible.map((post) => (
                            <div key={post.id} className="flex items-center justify-between gap-3 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl px-4 py-3">
                                <div>
                                    <p className="text-sm font-bold">{post.title}</p>
                                    <p className="text-[11px] text-[#86868b]">{post.published ? 'منتشر شده' : 'پیش‌نویس'}{post.featured ? ' · ویژه' : ''}</p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => openEdit(post)} className="text-xs font-bold text-[#1a73e8]">ویرایش</button>
                                    <button onClick={() => remove(post)} className="text-red-500"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        ))}
                        {!visible.length && <p className="text-xs text-[#86868b]">مطلبی نیست.</p>}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 w-full max-w-4xl" dir="rtl">
            <div className="flex items-center justify-between">
                <button onClick={() => setEditing(false)} className="text-xs font-bold text-[#1a73e8]">بازگشت به فهرست</button>
                <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1a73e8] text-white disabled:opacity-60">{saving ? 'در حال ذخیره…' : 'ذخیره مقاله'}</button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <section className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[1.5rem] p-5 flex flex-col gap-3">
                <h2 className="text-sm font-bold">اطلاعات پایه</h2>
                <label className="text-xs font-bold flex flex-col gap-1">عنوان مقاله
                    <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} placeholder="عنوان مقاله" />
                </label>
                <div className="grid md:grid-cols-2 gap-3">
                    <label className="text-xs font-bold flex flex-col gap-1">نامک
                        <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={field} placeholder="خالی بماند تا از عنوان ساخته شود" />
                    </label>
                    <label className="text-xs font-bold flex flex-col gap-1">دسته‌بندی
                        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={field}>
                            {CATS.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                    </label>
                    <label className="text-xs font-bold flex flex-col gap-1">نویسنده
                        <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className={field} />
                    </label>
                    <label className="text-xs font-bold flex flex-col gap-1">زمان مطالعه
                        <input value={form.readTime} onChange={(e) => setForm({ ...form, readTime: e.target.value })} className={field} placeholder="۵ دقیقه" />
                    </label>
                </div>
                <label className="text-xs font-bold flex flex-col gap-1">تصویر کاور (آدرس https)
                    <input value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} className={field} placeholder="https://" />
                </label>
                <label className="text-xs font-bold flex flex-col gap-1">خلاصه
                    <textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={3} className={field} />
                </label>
                <div className="flex gap-4 text-xs font-bold">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> مقاله ویژه</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> نمایش در سایت</label>
                </div>
            </section>
            <section className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[1.5rem] p-5 flex flex-col gap-3">
                <h2 className="text-sm font-bold">محتوای مقاله <span className="text-[#86868b] font-normal">{form.content.length} بلوک</span></h2>
                {!form.content.length && <p className="text-xs text-[#86868b] border border-dashed border-[#dadce0] dark:border-[#444746] rounded-xl p-4 text-center">محتوایی اضافه نشده. از دکمه‌های پایین بلوک بساز.</p>}
                {form.content.map((block, index) => (
                    <div key={index} className="flex gap-2 items-start border border-[#dadce0] dark:border-[#333537] rounded-xl p-3 bg-[#f8f9fa] dark:bg-[#131314]">
                        <div className="flex flex-col gap-1">
                            <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="text-[10px] disabled:opacity-30">▲</button>
                            <button type="button" disabled={index === form.content.length - 1} onClick={() => move(index, 1)} className="text-[10px] disabled:opacity-30">▼</button>
                        </div>
                        <div className="flex-1 flex flex-col gap-2 min-w-0">
                            <span className="text-[10px] font-bold text-[#1a73e8]">{BLOCKS.find((item) => item.type === block.type)?.label}</span>
                            {block.type === 'heading' && (
                                <div className="flex gap-2">
                                    <select value={block.level} onChange={(e) => setBlock(index, { ...block, level: Number(e.target.value) })} className={`${field} w-24`}>
                                        <option value={2}>H2</option>
                                        <option value={3}>H3</option>
                                    </select>
                                    <input value={block.text} onChange={(e) => setBlock(index, { ...block, text: e.target.value })} className={field} placeholder="متن تیتر" />
                                </div>
                            )}
                            {block.type === 'paragraph' && <RichText value={block.text} onChange={(html) => setBlock(index, { ...block, text: html })} />}
                            {block.type === 'list' && (
                                <div className="flex flex-col gap-2">
                                    {block.items.map((item, itemIndex) => (
                                        <div key={itemIndex} className="flex gap-2">
                                            <input value={item} onChange={(e) => {
                                                const items = [...block.items];
                                                items[itemIndex] = e.target.value;
                                                setBlock(index, { ...block, items });
                                            }} className={field} placeholder={`آیتم ${itemIndex + 1}`} />
                                            <button type="button" onClick={() => setBlock(index, { ...block, items: block.items.filter((_, i) => i !== itemIndex).concat(block.items.length === 1 ? [''] : []) })}><X size={14} /></button>
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => setBlock(index, { ...block, items: [...block.items, ''] })} className="text-xs font-bold text-[#1a73e8] self-start">افزودن آیتم</button>
                                </div>
                            )}
                            {block.type === 'image' && (
                                <div className="grid gap-2">
                                    <input value={block.url} onChange={(e) => setBlock(index, { ...block, url: e.target.value })} className={field} placeholder="آدرس تصویر https://" />
                                    <input value={block.alt} onChange={(e) => setBlock(index, { ...block, alt: e.target.value })} className={field} placeholder="متن جایگزین" />
                                    <input value={block.caption} onChange={(e) => setBlock(index, { ...block, caption: e.target.value })} className={field} placeholder="زیرنویس" />
                                </div>
                            )}
                            {block.type === 'video' && (
                                <div className="grid gap-2">
                                    <input value={block.url} onChange={(e) => setBlock(index, { ...block, url: e.target.value })} className={field} placeholder="آدرس ویدیو https://" />
                                    <input value={block.caption} onChange={(e) => setBlock(index, { ...block, caption: e.target.value })} className={field} placeholder="توضیح ویدیو" />
                                </div>
                            )}
                        </div>
                        <button type="button" onClick={() => setForm((current) => ({ ...current, content: current.content.filter((_, i) => i !== index) }))} className="text-red-500"><X size={14} /></button>
                    </div>
                ))}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed border-[#dadce0] dark:border-[#444746]">
                    {BLOCKS.map(({ type, label, icon: Icon }) => (
                        <button key={type} type="button" onClick={() => setForm((current) => ({ ...current, content: [...current.content, emptyBlock(type)] }))} className="px-3 py-1.5 rounded-full text-[11px] font-bold border border-[#dadce0] dark:border-[#444746] flex items-center gap-1">
                            <Icon size={13} /> {label}
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
}
