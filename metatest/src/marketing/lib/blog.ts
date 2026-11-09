export type BlogBlock = {
  type?: string;
  level?: number;
  text?: string;
  items?: string[];
  url?: string;
  alt?: string;
  caption?: string;
};

export type BlogPost = {
  title: string;
  slug: string;
  excerpt?: string;
  body?: string;
  content?: BlogBlock[];
  coverUrl?: string | null;
  category?: string;
  categorySlug?: string;
  categoryName?: string;
  categories?: { slug: string; name: string }[];
  readTime?: string;
  publishedAt?: string | null;
  featured?: boolean;
};

export const BLOG_CATEGORIES = [
  { slug: 'all', name: 'همه مطالب' },
  { slug: 'study', name: 'روش مطالعه' },
  { slug: 'exam', name: 'آزمون' },
  { slug: 'planning', name: 'برنامه‌ریزی' },
  { slug: 'ai', name: 'معلم هوشمند' },
];

export const LIST_SAMPLES: BlogPost[] = [
  { title: 'چطور یک فصل را در یک هفته جمع کنیم', slug: 'weekly-chapter-plan', excerpt: 'یک برنامه‌ی هفت‌روزه برای مرور فصل، بدون انباشته شدن جزوه.', category: 'study', categoryName: 'روش مطالعه', readTime: '۲ دقیقه', publishedAt: '2026-10-20', featured: true },
  { title: 'بعد از آزمون آزمایشی چه کار کنیم', slug: 'after-mock-exam', excerpt: 'درصد خام مهم است، ولی الگوی غلط‌ها مسیر هفته‌ی بعد را مشخص می‌کند.', category: 'exam', categoryName: 'آزمون', readTime: '۲ دقیقه', publishedAt: '2026-10-18', featured: false },
  { title: 'برنامه‌ی روزهای شلوغ مدرسه', slug: 'busy-school-days', excerpt: 'وقتی کلاس و تکلیف وقت را می‌گیرد، جلسه‌های کوتاه بهتر از برنامه‌ی سنگین است.', category: 'planning', categoryName: 'برنامه‌ریزی', readTime: '۲ دقیقه', publishedAt: '2026-10-15', featured: false },
  { title: 'چطور از معلم هوشمند متاتست سؤال بپرسیم', slug: 'ask-the-ai-teacher', excerpt: 'سؤال دقیق، پاسخ دقیق‌تری از معلم خصوصی می‌گیرد.', category: 'ai', categoryName: 'معلم هوشمند', readTime: '۲ دقیقه', publishedAt: '2026-10-12', featured: false },
];

export const POST_SAMPLES: Record<string, BlogPost> = {
  'weekly-chapter-plan': { title: 'چطور یک فصل را در یک هفته جمع کنیم', slug: 'weekly-chapter-plan', body: 'روز اول فقط عنوان‌ها و نمودار فصل را بخوان.\nروز دوم و سوم تست آموزشی بزن و غلط‌ها را علامت بزن.\nروز چهارم همان غلط‌ها را بدون نگاه به پاسخ حل کن.', publishedAt: '2026-10-20' },
  'after-mock-exam': { title: 'بعد از آزمون آزمایشی چه کار کنیم', slug: 'after-mock-exam', body: 'اول درصد هر درس را جدا بنویس.\nبعد سؤال‌هایی را که شک داشتی از سؤال‌هایی که بلد نبودی جدا کن.', publishedAt: '2026-10-18' },
  'busy-school-days': { title: 'برنامه‌ی روزهای شلوغ مدرسه', slug: 'busy-school-days', body: 'هر روز فقط یک بلوک چهل‌ دقیقه‌ای برای تست بگذار.\nاگر خسته‌ای، تعداد تست را کم کن ولی زمان را حذف نکن.', publishedAt: '2026-10-15' },
  'ask-the-ai-teacher': { title: 'چطور از معلم هوشمند متاتست سؤال بپرسیم', slug: 'ask-the-ai-teacher', body: 'به‌جای «این فصل را توضیح بده» بپرس «این تست را تا کجا خودم درست رفتم؟».\nبعد از پاسخ، یک تست مشابه حل کن.', publishedAt: '2026-10-12' },
};

export function postHref(slug: string) {
  return `/blog/post.html?slug=${encodeURIComponent(slug)}`;
}

export function formatWhen(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fa-IR');
}

export function safeHtml(html: string) {
  const holder = document.createElement('template');
  holder.innerHTML = String(html || '');
  holder.content.querySelectorAll('script,style,iframe,object').forEach((node) => node.remove());
  holder.content.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (attr.name.startsWith('on') || (attr.name === 'href' && /^\s*javascript:/i.test(attr.value))) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return holder.innerHTML;
}

export async function fetchCategories(): Promise<{ slug: string; name: string }[]> {
  const response = await fetch('/api/blog/categories');
  const payload = await response.json() as { success?: boolean; data?: { slug: string; name: string }[] };
  if (payload?.success && Array.isArray(payload.data)) return payload.data;
  return [];
}

export function postCategories(post: BlogPost) {
  if (post.categories?.length) return post.categories.map((item) => item.slug);
  return [post.category || post.categorySlug || 'study'];
}

export function coverStyle(url?: string | null): { backgroundImage: string; backgroundSize: string; backgroundPosition: string } | undefined {
  if (!url) return undefined;
  return {
    backgroundImage: `url("${url.replace(/"/g, '')}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}

export async function fetchPosts(): Promise<BlogPost[] | null> {
  const response = await fetch('/api/blog/posts');
  const payload = await response.json() as { success?: boolean; data?: BlogPost[] };
  if (payload?.success && Array.isArray(payload.data) && payload.data.length) return payload.data;
  return null;
}

export async function fetchPost(slug: string): Promise<BlogPost | null> {
  const response = await fetch(`/api/blog/posts/${encodeURIComponent(slug)}`);
  const payload = await response.json() as { success?: boolean; data?: BlogPost };
  if (response.ok && payload?.success && payload.data) return payload.data;
  return null;
}
