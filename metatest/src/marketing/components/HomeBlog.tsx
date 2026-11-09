import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { coverStyle, fetchPosts, formatWhen, LIST_SAMPLES, postHref, type BlogPost } from '../lib/blog';

export function HomeBlog() {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPosts()
      .then((rows) => { if (alive) setPosts(rows || LIST_SAMPLES); })
      .catch(() => { if (alive) setPosts(LIST_SAMPLES); });
    return () => { alive = false; };
  }, []);

  return (
    <section className="home-blog" id="home-blog">
      <div className="home-blog-inner">
        <div className="home-blog-head">
          <div>
            <div className="sec-eyebrow">یادداشت‌ها</div>
            <h2 className="shine-title">بلاگ آموزشی</h2>
          </div>
          <Link className="home-blog-more" to="/blog/">همه مطالب</Link>
        </div>
        <div className="home-blog-grid" id="home-blog-grid">
          {(posts || []).slice(0, 4).map((post) => {
            const when = formatWhen(post.publishedAt);
            return (
              <Link className="home-blog-card" to={postHref(post.slug)} key={post.slug}>
                <div className="home-blog-thumb" style={coverStyle(post.coverUrl)} />
                <div className="home-blog-body">
                  <span className="home-blog-cat">{post.categoryName || 'آموزش'}</span>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt || ''}</p>
                  <div className="home-blog-meta">{when}{post.readTime ? ` · ${post.readTime}` : ''}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
