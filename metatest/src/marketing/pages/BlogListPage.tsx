import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BLOG_CATEGORIES, LIST_SAMPLES, fetchPosts, formatWhen, postHref, type BlogPost } from '../lib/blog';
import { PageField } from '../components/PageField';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';

export function BlogListPage() {
  const [posts, setPosts] = useState<BlogPost[]>(LIST_SAMPLES);
  const [drawn, setDrawn] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('all');

  useEffect(() => {
    let alive = true;
    fetchPosts()
      .then((rows) => { if (alive && rows) setPosts(rows); })
      .catch(() => undefined)
      .finally(() => { if (alive) setDrawn(true); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => posts.filter((post) => {
    const cat = post.category || post.categorySlug || 'study';
    const q = query.trim();
    const hit = !q || `${post.title} ${post.excerpt || ''}`.includes(q);
    return hit && (active === 'all' || cat === active);
  }), [posts, query, active]);

  const featured = !query.trim() && active === 'all' ? (filtered.find((post) => post.featured) || filtered[0]) : null;
  const rest = featured ? filtered.filter((post) => post.slug !== featured.slug) : filtered;
  const show = drawn || query.trim().length > 0 || active !== 'all';

  return (
    <PageField>
      <SiteHeader active="blog" logoLinkClass="logo" />
      <main>
        <div className="eyebrow">مجله متاتست</div>
        <h1>بلاگ آموزشی</h1>
        <p className="lead">راهنمای مطالعه، تحلیل آزمون و کار با معلم هوشمند. مطالب تازه را از پنل ادمین منتشر کنید؛ همین صفحه به‌روز می‌شود.</p>
        <div className="blog-search">
          <input id="q" type="search" placeholder="جستجو در مطالب… (مثلاً: آزمون، برنامه‌ریزی)" aria-label="جستجو در مطالب" value={query} onChange={(event) => { setQuery(event.target.value); setDrawn(true); }} />
        </div>
        <div className="blog-tabs" id="tabs">
          {BLOG_CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              data-cat={cat.slug}
              className={cat.slug === active ? 'active' : undefined}
              onClick={() => { setActive(cat.slug); setDrawn(true); }}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <div id="featured">
          {show && featured ? (
            <Link className="blog-featured" to={postHref(featured.slug)}>
              <div className="blog-featured-thumb" />
              <div className="blog-featured-body">
                <span className="eyebrow">مطلب ویژه · {featured.categoryName || ''}</span>
                <h2>{featured.title}</h2>
                <p>{featured.excerpt || ''}</p>
                <div className="blog-card-meta">
                  <span>{formatWhen(featured.publishedAt)}</span>
                  <span>{featured.readTime || ''}</span>
                </div>
              </div>
            </Link>
          ) : null}
        </div>
        <div className="blog-grid" id="grid">
          {show ? rest.map((post) => (
            <Link className="blog-card" to={postHref(post.slug)} key={post.slug}>
              <div className="blog-card-thumb"><span className="blog-card-cat">{post.categoryName || 'آموزش'}</span></div>
              <div className="blog-card-body">
                <h3>{post.title}</h3>
                <p>{post.excerpt || ''}</p>
                <div className="blog-card-meta">
                  <span>{formatWhen(post.publishedAt)}</span>
                  <span>{post.readTime || ''}</span>
                </div>
              </div>
            </Link>
          )) : null}
        </div>
        <p className="status" id="status">{!show ? 'در حال دریافت مطالب…' : filtered.length ? '' : 'مطلبی با این جستجو پیدا نشد.'}</p>
      </main>
      <SiteFooter variant="sub" enamadClass />
    </PageField>
  );
}
