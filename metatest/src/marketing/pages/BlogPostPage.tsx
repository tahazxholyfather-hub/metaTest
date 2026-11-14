import { Check, Link2, MessageCircle, Search, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { ArticleComments } from '../components/ArticleComments';
import { PostCard } from '../components/PostCard';
import { fetchPost, fetchPosts, formatWhen, LIST_SAMPLES, POST_SAMPLES, postHref, readingLabel, safeHtml, type BlogBlock, type BlogPost } from '../lib/blog';
import { coverFor } from '../lib/covers';

function Blocks({ post }: { post: BlogPost }) {
  const blocks = Array.isArray(post.content) ? post.content : [];
  if (!blocks.length) return <div className="body">{post.body || ''}</div>;
  return (
    <>
      {blocks.map((block, index) => <Block key={index} block={block} />)}
    </>
  );
}

function Block({ block }: { block: BlogBlock }) {
  if (block.type === 'heading') {
    const Tag = Number(block.level) === 3 ? 'h3' : 'h2';
    return <div className="article-block"><Tag>{block.text}</Tag></div>;
  }
  if (block.type === 'list') {
    return (
      <div className="article-block">
        <ul>{(block.items || []).map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    );
  }
  if (block.type === 'image' && block.url) {
    return (
      <figure className="article-block">
        <img alt={block.alt || ''} src={block.url} />
        {block.caption ? <figcaption>{block.caption}</figcaption> : null}
      </figure>
    );
  }
  if (block.type === 'video' && block.url) {
    return (
      <figure className="article-block">
        <video controls src={block.url} />
      </figure>
    );
  }
  return <div className="article-block article-html" dangerouslySetInnerHTML={{ __html: safeHtml(block.text || '') }} />;
}

function ShareBar({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function openShare(href: string) {
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="read-share">
      <button type="button" onClick={copyLink}>
        {copied ? <Check size={14} strokeWidth={1.75} aria-hidden="true" /> : <Link2 size={14} strokeWidth={1.75} aria-hidden="true" />}
        {copied ? 'کپی شد' : 'کپی پیوند'}
      </button>
      <button type="button" onClick={() => openShare(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(title)}`)}>
        <Send size={14} strokeWidth={1.75} aria-hidden="true" />
        تلگرام
      </button>
      <button type="button" onClick={() => openShare(`https://wa.me/?text=${encodeURIComponent(`${title} ${window.location.href}`)}`)}>
        <MessageCircle size={14} strokeWidth={1.75} aria-hidden="true" />
        واتساپ
      </button>
    </div>
  );
}

export function BlogPostPage() {
  const params = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const slug = search.get('slug') || params.slug || '';
  const [post, setPost] = useState<BlogPost | null>(null);
  const [others, setOthers] = useState<BlogPost[]>([]);
  const [missing, setMissing] = useState(false);
  const [loadedSlug, setLoadedSlug] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!slug) return undefined;
    let alive = true;
    setLoadedSlug('');
    fetchPost(slug)
      .then((row) => {
        if (!alive) return;
        if (row) {
          setPost(row);
          setMissing(false);
        } else if (POST_SAMPLES[slug]) {
          const listed = LIST_SAMPLES.find((item) => item.slug === slug);
          setPost({ ...listed, ...POST_SAMPLES[slug] });
          setMissing(false);
        } else {
          setPost(null);
          setMissing(true);
        }
      })
      .catch(() => {
        if (!alive) return;
        if (POST_SAMPLES[slug]) {
          const listed = LIST_SAMPLES.find((item) => item.slug === slug);
          setPost({ ...listed, ...POST_SAMPLES[slug] });
          setMissing(false);
        } else {
          setPost(null);
          setMissing(true);
        }
      })
      .finally(() => { if (alive) setLoadedSlug(slug); });
    fetchPosts()
      .then((rows) => { if (alive) setOthers((rows || LIST_SAMPLES).filter((item) => item.slug !== slug)); })
      .catch(() => { if (alive) setOthers(LIST_SAMPLES.filter((item) => item.slug !== slug)); });
    return () => { alive = false; };
  }, [slug]);

  const ready = !slug || loadedSlug === slug;
  const current = loadedSlug === slug ? post : null;

  useEffect(() => {
    document.title = current ? `${current.title} — متاتست` : 'بلاگ آموزشی — متاتست';
  }, [current]);

  const filtered = useMemo(() => {
    const needle = query.trim();
    if (!needle) return others;
    return others.filter((item) => `${item.title} ${item.excerpt || ''} ${item.categoryName || ''}`.includes(needle));
  }, [others, query]);

  return (
    <div className="page-root">
      <SiteHeader active="blog" />
      <main className="page-footer-rail">
        <article className="read read-sheet">
          {!slug ? <p className="status">مطلبی انتخاب نشده است.</p> : null}
          {slug && !ready ? <p className="status">در حال دریافت مطلب…</p> : null}
          {slug && ready && missing ? <p className="status">این مطلب پیدا نشد.</p> : null}
          {current ? (
            <>
              <nav className="breadcrumbs" aria-label="مسیر">
                <ol>
                  <li><Link to="/">خانه</Link></li>
                  <li><Link to="/blog/">وبلاگ</Link></li>
                  <li><span aria-current="page">{current.title}</span></li>
                </ol>
              </nav>
              <div className="read-layout">
                <div className="read-main">
                  <div className="read-cover-wrap">
                    <div className="read-cover">
                      <img src={coverFor(current.slug, current.coverUrl)} alt="" />
                    </div>
                  </div>
                  <p className="read-kicker">{current.categoryName || 'آموزش'}</p>
                  <h1>{current.title}</h1>
                  {current.excerpt ? <p className="read-dek">{current.excerpt}</p> : null}
                  <div className="read-byline">
                    {current.publishedAt ? <time dateTime={current.publishedAt}>{formatWhen(current.publishedAt)}</time> : null}
                    <i />
                    <span>{readingLabel(current)}</span>
                  </div>
                  <ShareBar title={current.title} />
                  <div className="read-author-card read-author-inline">
                    <img src="https://metatest.app/logo.png" alt="" />
                    <strong>متاتست</strong>
                  </div>
                  <div className="read-prose prose">
                    <Blocks post={current} />
                  </div>
                  {others.length ? (
                    <section className="read-rail" aria-label="نوشته‌های دیگر">
                      <h2>نوشته‌های دیگر</h2>
                      <div className="read-rail-row">
                        {others.slice(0, 6).map((item) => <PostCard key={item.slug} post={item} titleAs="h3" />)}
                      </div>
                    </section>
                  ) : null}
                </div>
                <aside className="read-side">
                  <div className="read-author-card">
                    <img src="https://metatest.app/logo.png" alt="" />
                    <strong>متاتست</strong>
                  </div>
                  <form
                    className="library-search read-side-search"
                    role="search"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const value = query.trim();
                      navigate(value ? `/blog/?q=${encodeURIComponent(value)}` : '/blog/');
                    }}
                  >
                    <Search size={16} strokeWidth={1.75} aria-hidden="true" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="جستجو در نوشته‌ها"
                      aria-label="جستجو در نوشته‌ها"
                    />
                  </form>
                  <p className="read-side-label">نوشته‌های دیگر</p>
                  {filtered.length === 0 ? (
                    <p className="read-side-empty">در این فهرست نیست.</p>
                  ) : (
                    <ul>
                      {filtered.map((item) => (
                        <li key={item.slug}>
                          <Link to={postHref(item.slug)}>
                            <img src={coverFor(item.slug, item.coverUrl)} alt="" />
                            <span>
                              <small>{item.categoryName || 'آموزش'}</small>
                              <strong>{item.title}</strong>
                              <em>
                                {formatWhen(item.publishedAt)}
                                <i />
                                {readingLabel(item)}
                              </em>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </aside>
              </div>
              <ArticleComments slug={current.slug} />
            </>
          ) : null}
        </article>
      </main>
      <SiteFooter variant="sub" enamadClass />
    </div>
  );
}
