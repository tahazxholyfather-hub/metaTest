import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchPosts, LIST_SAMPLES, type BlogPost } from '../lib/blog';
import { PostCard } from './PostCard';

export function HomeBlog() {
  const scroller = useRef<HTMLDivElement>(null);
  const [posts, setPosts] = useState<BlogPost[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPosts()
      .then((rows) => { if (alive) setPosts(rows || LIST_SAMPLES); })
      .catch(() => { if (alive) setPosts(LIST_SAMPLES); });
    return () => { alive = false; };
  }, []);

  function move(direction: 1 | -1) {
    const root = scroller.current;
    if (!root) return;
    const slide = root.querySelector<HTMLElement>('.deck-slide');
    const width = (slide?.getBoundingClientRect().width || 280) + 16;
    const sign = getComputedStyle(root).direction === 'rtl' ? -1 : 1;
    root.scrollBy({ left: direction * width * sign, behavior: 'smooth' });
  }

  const cards = posts || [];

  return (
    <section className="journal-deck" id="home-blog" aria-labelledby="latest-title">
      <div className="journal-deck-panel">
        <div className="journal-deck-head">
          <h2 id="latest-title" className="shine-title">تازه‌های بلاگ</h2>
        </div>
        {posts && cards.length === 0 ? (
          <p className="journal-empty">هنوز مطلبی منتشر نشده است.</p>
        ) : (
          <>
            <div className="deck-scroller" ref={scroller}>
              {(posts ? cards : LIST_SAMPLES).map((post) => (
                <div className="deck-slide" key={post.slug}>
                  <PostCard post={post} titleAs="h3" />
                </div>
              ))}
            </div>
            <div className="deck-controls">
              <button type="button" className="btn-line deck-arrow" aria-label="مطلب قبلی" onClick={() => move(-1)}>
                <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <Link className="btn-line" to="/blog/">همه مطالب</Link>
              <button type="button" className="btn-line deck-arrow" aria-label="مطلب بعدی" onClick={() => move(1)}>
                <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
