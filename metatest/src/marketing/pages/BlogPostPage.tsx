import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { POST_SAMPLES, fetchPost, formatWhen, safeHtml, type BlogBlock, type BlogPost } from '../lib/blog';
import { BackBlogIcon } from '../components/icons';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';

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
        {block.caption ? <figcaption className="meta">{block.caption}</figcaption> : null}
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

export function BlogPostPage() {
  const params = useParams();
  const [search] = useSearchParams();
  const slug = search.get('slug') || params.slug || '';
  const [post, setPost] = useState<BlogPost | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadedSlug, setLoadedSlug] = useState('');

  useEffect(() => {
    if (!slug) return undefined;
    let alive = true;
    fetchPost(slug)
      .then((row) => {
        if (!alive) return;
        if (row) {
          setPost(row);
          setMissing(false);
        } else if (POST_SAMPLES[slug]) {
          setPost(POST_SAMPLES[slug]);
          setMissing(false);
        } else {
          setPost(null);
          setMissing(true);
        }
      })
      .catch(() => {
        if (!alive) return;
        if (POST_SAMPLES[slug]) {
          setPost(POST_SAMPLES[slug]);
          setMissing(false);
        } else {
          setPost(null);
          setMissing(true);
        }
      })
      .finally(() => { if (alive) setLoadedSlug(slug); });
    return () => { alive = false; };
  }, [slug]);

  const ready = !slug || loadedSlug === slug;
  const current = loadedSlug === slug ? post : null;

  useEffect(() => {
    document.title = current ? `${current.title} — متاتست` : 'بلاگ آموزشی — متاتست';
  }, [current]);

  const date = formatWhen(current?.publishedAt);

  return (
    <>
      <SiteHeader active="blog" />
      <main>
        <Link className="back" to="/blog/">
          <BackBlogIcon />
          بازگشت به بلاگ
        </Link>
        <article id="article">
          {!slug ? <p className="status">مطلبی انتخاب نشده است.</p> : null}
          {slug && !ready ? <p className="status" id="status">در حال دریافت مطلب…</p> : null}
          {slug && ready && missing ? <p className="status">این مطلب پیدا نشد.</p> : null}
          {current ? (
            <>
              <h1>{current.title}</h1>
              <p className="meta">{date}{current.readTime ? ` · ${current.readTime}` : ''}</p>
              {current.coverUrl ? <img className="cover" alt="" src={current.coverUrl} /> : null}
              <Blocks post={current} />
            </>
          ) : null}
        </article>
      </main>
      <SiteFooter variant="sub" enamadClass />
    </>
  );
}
