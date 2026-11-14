import { Calendar, ChevronLeft, Clock, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatWhen, postHref, readingLabel, type BlogPost } from '../lib/blog';
import { coverFor } from '../lib/covers';

export function PostCard({ post, titleAs = 'h2' }: { post: BlogPost; titleAs?: 'h2' | 'h3' }) {
  const Title = titleAs;
  return (
    <article className="post-card">
      <Link to={postHref(post.slug)}>
        <div className="post-card-copy">
          <span className="post-card-badge">
            <GraduationCap size={14} strokeWidth={1.75} aria-hidden="true" />
            {post.categoryName || 'آموزش'}
          </span>
          <Title>{post.title}</Title>
          <p>{post.excerpt || ''}</p>
          <div className="post-card-foot">
            <span className="post-card-more">
              <ChevronLeft size={14} strokeWidth={1.75} aria-hidden="true" />
              مطالعه بیشتر
            </span>
            <span className="post-card-meta">
              <span>
                <Clock size={13} strokeWidth={1.75} aria-hidden="true" />
                {readingLabel(post)}
              </span>
              {post.publishedAt ? (
                <span>
                  <Calendar size={13} strokeWidth={1.75} aria-hidden="true" />
                  <time dateTime={post.publishedAt}>{formatWhen(post.publishedAt)}</time>
                </span>
              ) : null}
            </span>
            <span className="post-card-go" aria-hidden="true">
              <ChevronLeft size={16} strokeWidth={1.75} />
            </span>
          </div>
        </div>
        <div className="post-card-visual">
          <img src={coverFor(post.slug, post.coverUrl)} alt="" />
        </div>
      </Link>
    </article>
  );
}
