import { useEffect, useState } from 'react';
import { adminApi } from '../lib/adminApi';
import { BlogEditor } from './blog/BlogEditor';
import { BlogList } from './blog/BlogList';
import { EMPTY_DRAFT, type BlogDraft, type BlogPost, type Block } from './blog/types';

function draftFromPost(post: BlogPost): BlogDraft {
    const content: Block[] = Array.isArray(post.content) && post.content.length
        ? post.content
        : (post.body ? [{ type: 'paragraph', text: post.body.replace(/\n/g, '<br>') }] : []);
    return {
        ...EMPTY_DRAFT,
        ...post,
        coverUrl: post.coverUrl || '',
        author: post.author || 'تیم متاتست',
        readTime: post.readTime || '',
        content,
    };
}

export default function BlogManager() {
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [form, setForm] = useState<BlogDraft>(EMPTY_DRAFT);
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
            setPosts((res.data || []) as BlogPost[]);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'دریافت مطالب ممکن نشد');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

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

    const remove = async (post: BlogPost) => {
        if (!window.confirm(`حذف «${post.title}»؟`)) return;
        try {
            await adminApi.deleteBlog(post.id);
            await load();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'حذف ممکن نشد');
        }
    };

    if (!editing) {
        return (
            <BlogList
                posts={posts}
                query={query}
                loading={loading}
                error={error}
                success={success}
                onQuery={setQuery}
                onCreate={() => { setForm(EMPTY_DRAFT); setEditing(true); setSuccess(null); setError(null); }}
                onEdit={(post) => { setForm(draftFromPost(post)); setEditing(true); setSuccess(null); setError(null); }}
                onDelete={(post) => { void remove(post); }}
            />
        );
    }

    return (
        <BlogEditor
            form={form}
            saving={saving}
            error={error}
            onChange={setForm}
            onBack={() => setEditing(false)}
            onSave={() => { void save(); }}
        />
    );
}
