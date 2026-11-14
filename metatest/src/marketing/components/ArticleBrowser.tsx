import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BLOG_CATEGORIES, fetchCategories, fetchPosts, LIST_SAMPLES, postCategories, readingMinutes, type BlogPost } from '../lib/blog';
import { PostCard } from './PostCard';

type SortId = 'new' | 'old' | 'short';

const SORTS: { id: SortId; label: string }[] = [
  { id: 'new', label: 'تازه‌ترین' },
  { id: 'old', label: 'قدیمی‌ترین' },
  { id: 'short', label: 'کوتاه‌ترین' },
];

function norm(value: string) {
  return value
    .replace(/[\u200c\u200d]/g, ' ')
    .replace(/[يﻯ]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function asSort(value: string | null): SortId {
  return value === 'old' || value === 'short' ? value : 'new';
}

export function ArticleBrowser() {
  const [params, setParams] = useSearchParams();
  const initialQuery = params.get('q') || '';
  const initialCategory = params.get('cat') || 'all';
  const initialSort = asSort(params.get('sort'));
  const timer = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const live = useRef({ q: initialQuery, cat: initialCategory, sort: initialSort });
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState(BLOG_CATEGORIES.filter((item) => item.slug !== 'all'));
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState<SortId>(initialSort);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPosts()
      .then((rows) => { if (alive) setPosts(rows || LIST_SAMPLES); })
      .catch(() => { if (alive) setPosts(LIST_SAMPLES); })
      .finally(() => { if (alive) setReady(true); });
    fetchCategories()
      .then((rows) => { if (alive && rows.length) setCategories(rows); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const named = useMemo(() => {
    const map = new Map(categories.map((item) => [item.slug, item.name]));
    return posts.map((post) => ({
      ...post,
      categoryName: post.categoryName || map.get(post.category || '') || 'آموزش',
    }));
  }, [posts, categories]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const post of named) {
      for (const slug of postCategories(post)) map.set(slug, (map.get(slug) ?? 0) + 1);
    }
    return map;
  }, [named]);

  const visible = useMemo(() => {
    const needle = norm(query);
    const list = named.filter((post) => {
      if (category !== 'all' && !postCategories(post).includes(category)) return false;
      if (!needle) return true;
      return norm(`${post.title} ${post.excerpt || ''} ${post.categoryName || ''}`).includes(needle);
    });
    return list.sort((a, b) => {
      if (sort === 'short') return readingMinutes(a) - readingMinutes(b);
      const left = a.publishedAt || '';
      const right = b.publishedAt || '';
      if (sort === 'old') return left < right ? -1 : 1;
      return left < right ? 1 : -1;
    });
  }, [named, category, query, sort]);

  function writeUrl(q: string, cat: string, sortId: SortId) {
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    if (cat !== 'all') next.set('cat', cat);
    if (sortId !== 'new') next.set('sort', sortId);
    setParams(next, { replace: true });
  }

  function onQuery(value: string) {
    live.current.q = value;
    setQuery(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const now = live.current;
      writeUrl(now.q, now.cat, now.sort);
    }, 160);
  }

  function onCategory(value: string) {
    window.clearTimeout(timer.current);
    live.current.cat = value;
    setCategory(value);
    writeUrl(live.current.q, value, live.current.sort);
  }

  function onSort(value: SortId) {
    window.clearTimeout(timer.current);
    live.current.sort = value;
    setSort(value);
    writeUrl(live.current.q, live.current.cat, value);
  }

  function resetAll() {
    window.clearTimeout(timer.current);
    live.current = { q: '', cat: 'all', sort: 'new' };
    setQuery('');
    setCategory('all');
    setSort('new');
    writeUrl('', 'all', 'new');
  }

  useEffect(() => {
    const q = params.get('q') || '';
    const cat = params.get('cat') || 'all';
    const sortId = asSort(params.get('sort'));
    live.current = { q, cat, sort: sortId };
    setQuery(q);
    setCategory(cat);
    setSort(sortId);
  }, [params]);

  useEffect(() => {
    if (!sheet) return undefined;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheet(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [sheet]);

  const filtersActive = (category !== 'all' ? 1 : 0) + (query.trim() ? 1 : 0) + (sort !== 'new' ? 1 : 0);
  const sortLabel = SORTS.find((item) => item.id === sort)?.label ?? 'تازه‌ترین';
  const activeName = categories.find((item) => item.slug === category)?.name || category;

  const filters = (
    <>
      <div className="library-group">
        <h2>دسته‌بندی</h2>
        <button type="button" className="library-cat" aria-pressed={category === 'all'} onClick={() => onCategory('all')}>
          <i />
          <span>همه</span>
          <b>{named.length.toLocaleString('fa-IR')}</b>
        </button>
        {categories.map((item) => (
          <button key={item.slug} type="button" className="library-cat" aria-pressed={category === item.slug} onClick={() => onCategory(item.slug)}>
            <i />
            <span>{item.name}</span>
            <b>{(counts.get(item.slug) ?? 0).toLocaleString('fa-IR')}</b>
          </button>
        ))}
      </div>
      <div className="library-group">
        <h2>مرتب‌سازی</h2>
        <div
          className="library-seg"
          role="group"
          aria-label="ترتیب نمایش"
          style={{ '--sort-i': Math.max(0, SORTS.findIndex((item) => item.id === sort)) } as CSSProperties}
        >
          {SORTS.map((item) => (
            <button key={item.id} type="button" aria-pressed={sort === item.id} onClick={() => onSort(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="library">
      <div className="library-side">
        <aside className="library-aside" aria-label="جستجو و فیلترها">
          <div className="library-brand">
            <h1 className="shine-title">وبلاگ</h1>
            <img src="https://metatest.app/logo.png" alt="" />
          </div>
          <SearchField value={query} onChange={onQuery} placeholder="جستجو در عنوان و موضوع…" label="جستجو در نوشته‌ها" />
          {filtersActive > 0 ? (
            <div className="library-chips">
              {category !== 'all' ? (
                <span>
                  {activeName}
                  <button type="button" aria-label={`حذف دسته ${activeName}`} onClick={() => onCategory('all')}>
                    <X size={10} strokeWidth={2.4} />
                  </button>
                </span>
              ) : null}
              {query.trim() ? (
                <span>
                  «{query.trim()}»
                  <button type="button" aria-label="حذف جستجو" onClick={() => onQuery('')}>
                    <X size={10} strokeWidth={2.4} />
                  </button>
                </span>
              ) : null}
              {sort !== 'new' ? (
                <span>
                  {sortLabel}
                  <button type="button" aria-label="بازگشت به تازه‌ترین" onClick={() => onSort('new')}>
                    <X size={10} strokeWidth={2.4} />
                  </button>
                </span>
              ) : null}
            </div>
          ) : null}
          {filters}
          <button type="button" className="btn-line library-reset" onClick={resetAll} disabled={filtersActive === 0}>
            پاک کردن فیلترها
          </button>
        </aside>
      </div>

      <div className="library-main">
        <div className="library-mbar">
          <div className="library-mbar-in">
            <SearchField value={query} onChange={onQuery} placeholder="جستجو در نوشته‌ها…" label="جستجو در نوشته‌ها" />
            <button
              type="button"
              className={filtersActive ? 'library-fbtn is-on' : 'library-fbtn'}
              aria-expanded={sheet}
              aria-controls="library-sheet"
              onClick={() => setSheet(true)}
            >
              <SlidersHorizontal size={18} strokeWidth={1.75} />
              <span className="sr-only">فیلترها</span>
              {filtersActive > 0 ? <span className="library-bubble">{filtersActive.toLocaleString('fa-IR')}</span> : null}
            </button>
          </div>
        </div>
        <div className="library-stage">
          {!ready ? (
            <div className="post-bones" aria-hidden="true">
              {Array.from({ length: 3 }, (_, index) => (
                <div className="post-bone" key={index}>
                  <div className="post-bone-copy"><span /><span /><span /><span /></div>
                  <div className="post-bone-visual" />
                </div>
              ))}
            </div>
          ) : null}
          {ready && visible.length === 0 ? (
            <div className="library-empty">
              <b>چیزی پیدا نشد</b>
              <p>با این عبارت یا فیلتر نوشته‌ای نداریم.</p>
              <button type="button" className="btn-fill" onClick={resetAll}>پاک کردن فیلترها</button>
            </div>
          ) : null}
          {ready && visible.length > 0 ? (
            <div className="library-grid">
              {visible.map((post, index) => (
                <div key={post.slug} style={{ '--i': index } as CSSProperties}>
                  <PostCard post={post} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="library-sheet" id="library-sheet" hidden={!sheet}>
        <button type="button" className="library-sheet-bd" aria-label="بستن فیلترها" onClick={() => setSheet(false)} />
        <div className="library-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="library-sheet-title" ref={sheetRef}>
          <div className="library-grab" aria-hidden="true" />
          <div className="library-sheet-head">
            <b id="library-sheet-title">فیلترها</b>
            <button type="button" aria-label="بستن" onClick={() => setSheet(false)}>
              <X size={14} strokeWidth={2} />
            </button>
          </div>
          <div className="library-sheet-body">{filters}</div>
          <div className="library-sheet-foot">
            <button type="button" className="btn-line" onClick={resetAll}>پاک کردن</button>
            <button type="button" className="btn-fill" onClick={() => setSheet(false)}>
              نمایش {visible.length.toLocaleString('fa-IR')} نوشته
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className={value ? 'library-search has-value' : 'library-search'}>
      <Search size={16} strokeWidth={1.75} aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button type="button" aria-label="پاک کردن جستجو" onClick={() => onChange('')}>
          <X size={12} strokeWidth={2.2} />
        </button>
      ) : null}
    </label>
  );
}
