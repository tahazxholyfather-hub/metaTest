import { useEffect, useState, type FormEvent } from 'react';

export type PublicComment = {
  id: number;
  name: string;
  body: string;
  createdAt: string | null;
};

export async function fetchComments(slug: string): Promise<PublicComment[]> {
  const res = await fetch(`/api/blog/posts/${encodeURIComponent(slug)}/comments`);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.success) throw new Error(payload?.message || 'comments');
  return Array.isArray(payload.comments) ? payload.comments : [];
}

export async function submitComment(slug: string, name: string, body: string, website: string) {
  const res = await fetch(`/api/blog/posts/${encodeURIComponent(slug)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, body, website }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.success) {
    const error = new Error(payload?.message || 'ثبت دیدگاه ممکن نشد.') as Error & { fields?: Record<string, string> };
    error.fields = payload?.errors;
    throw error;
  }
  return String(payload.message || 'دیدگاه ثبت شد و بعد از تأیید نمایش داده می‌شود.');
}

function when(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

export function ArticleComments({ slug }: { slug: string }) {
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [website, setWebsite] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchComments(slug)
      .then((rows) => { if (alive) setComments(rows); })
      .catch(() => { if (alive) setComments([]); });
    return () => { alive = false; };
  }, [slug]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    setError('');
    setSending(true);
    try {
      const message = await submitComment(slug, name, text, website);
      setText('');
      setNotice(message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'ثبت دیدگاه ممکن نشد.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="read-comments" aria-labelledby="read-comments-title">
      <div className="read-comments-head">
        <h2 id="read-comments-title">دیدگاه‌ها</h2>
        <span>{comments.length.toLocaleString('fa-IR')}</span>
      </div>
      {comments.length === 0 ? <p className="read-comments-empty">هنوز دیدگاهی نوشته نشده.</p> : null}
      <ul>
        {comments.map((comment) => (
          <li key={comment.id}>
            <div className="read-comment-top">
              <span className="read-comment-avatar" aria-hidden="true">{comment.name.slice(0, 1)}</span>
              <b>{comment.name}</b>
              {comment.createdAt ? <time dateTime={comment.createdAt}>{when(comment.createdAt)}</time> : null}
            </div>
            <p>{comment.body}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={onSubmit}>
        <label className="contact-trap" aria-hidden="true">
          وب‌سایت
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </label>
        <label>
          نام
          <input value={name} maxLength={80} autoComplete="name" onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          دیدگاه
          <textarea value={text} maxLength={2000} rows={4} onChange={(event) => setText(event.target.value)} required />
        </label>
        <div className="read-comments-row">
          <p>{notice || error || 'دیدگاه بعد از تأیید نمایش داده می‌شود.'}</p>
          <button type="submit" className="btn-fill" disabled={sending}>{sending ? 'در حال ثبت…' : 'ثبت دیدگاه'}</button>
        </div>
      </form>
    </section>
  );
}
