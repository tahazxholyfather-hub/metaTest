export type Block =
    | { type: 'heading'; level: number; text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'list'; items: string[] }
    | { type: 'image'; url: string; alt: string; caption: string }
    | { type: 'video'; url: string; caption: string };

export interface BlogPost {
    id: number;
    title: string;
    slug: string;
    excerpt: string;
    body: string;
    content?: Block[];
    coverUrl: string | null;
    author?: string;
    category: string;
    featured: boolean;
    published: boolean;
    readTime?: string;
}

export interface BlogDraft {
    id: number;
    title: string;
    slug: string;
    excerpt: string;
    coverUrl: string;
    author: string;
    category: string;
    featured: boolean;
    published: boolean;
    readTime: string;
    content: Block[];
}

export const EMPTY_DRAFT: BlogDraft = {
    id: 0,
    title: '',
    slug: '',
    excerpt: '',
    coverUrl: '',
    author: 'تیم متاتست',
    category: 'study',
    featured: false,
    published: true,
    readTime: '',
    content: [],
};

export const BLOG_CATEGORIES = [
    { id: 'study', name: 'روش مطالعه' },
    { id: 'exam', name: 'آزمون' },
    { id: 'planning', name: 'برنامه‌ریزی' },
    { id: 'ai', name: 'معلم هوشمند' },
];

export const fieldClass = 'rounded-xl border border-[#dadce0] dark:border-[#444746] bg-transparent px-3 py-2 text-sm w-full';

export function emptyBlock(type: string): Block {
    if (type === 'heading') return { type: 'heading', level: 2, text: '' };
    if (type === 'list') return { type: 'list', items: [''] };
    if (type === 'image') return { type: 'image', url: '', alt: '', caption: '' };
    if (type === 'video') return { type: 'video', url: '', caption: '' };
    return { type: 'paragraph', text: '' };
}
