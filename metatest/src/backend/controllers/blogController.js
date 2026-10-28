'use strict';

const pool = require('../db');
const { slugify, cleanText, cleanCoverUrl } = require('../blog/text');

const CATEGORIES = {
    study: 'روش مطالعه',
    exam: 'آزمون',
    planning: 'برنامه‌ریزی',
    ai: 'معلم هوشمند',
};

const SAMPLE_POSTS = [
    {
        title: 'چطور یک فصل را در یک هفته جمع کنیم',
        slug: 'weekly-chapter-plan',
        category: 'study',
        featured: 1,
        excerpt: 'یک برنامه‌ی هفت‌روزه برای مرور فصل، بدون انباشته شدن جزوه.',
        body: 'روز اول فقط عنوان‌ها و نمودار فصل را بخوان.\nروز دوم و سوم تست آموزشی بزن و غلط‌ها را علامت بزن.\nروز چهارم همان غلط‌ها را بدون نگاه به پاسخ حل کن.\nروز پنجم یک آزمون کوتاه زمان‌دار بگیر.\nروز ششم نقاط ضعف را با معلم هوشمند مرور کن.\nروز هفتم فقط جمع‌بندی یک صفحه‌ای بنویس.',
    },
    {
        title: 'بعد از آزمون آزمایشی چه کار کنیم',
        slug: 'after-mock-exam',
        category: 'exam',
        featured: 0,
        excerpt: 'درصد خام مهم است، ولی الگوی غلط‌ها مسیر هفته‌ی بعد را مشخص می‌کند.',
        body: 'اول درصد هر درس را جدا بنویس.\nبعد سؤال‌هایی را که شک داشتی از سؤال‌هایی که بلد نبودی جدا کن.\nبرای هر درس فقط دو مبحث تکراری را انتخاب کن و همان‌ها را سه روز تمرین کن.\nتحلیل را همان روز آزمون بنویس، نه آخر هفته.',
    },
    {
        title: 'برنامه‌ی روزهای شلوغ مدرسه',
        slug: 'busy-school-days',
        category: 'planning',
        featured: 0,
        excerpt: 'وقتی کلاس و تکلیف وقت را می‌گیرد، جلسه‌های کوتاه بهتر از برنامه‌ی سنگین است.',
        body: 'هر روز فقط یک بلوک چهل‌ دقیقه‌ای برای تست بگذار.\nاگر خسته‌ای، تعداد تست را کم کن ولی زمان را حذف نکن.\nجمعه را برای جبران نگذار؛ همان روز یک مرور ده‌دقیقه‌ای کافی است.\nهدف، ادامه‌دار بودن تمرین است نه حجم زیاد.',
    },
    {
        title: 'چطور از معلم هوشمند متاتست سؤال بپرسیم',
        slug: 'ask-the-ai-teacher',
        category: 'ai',
        featured: 0,
        excerpt: 'سؤال دقیق، پاسخ دقیق‌تری از معلم خصوصی می‌گیرد.',
        body: 'به‌جای «این فصل را توضیح بده» بپرس «این تست را تا کجا خودم درست رفتم؟».\nگزینه‌ای که بین دو جواب مردد بودی را بنویس.\nاگر فرمول یا شکل داری، همان را در سؤال بیاور.\nبعد از پاسخ، یک تست مشابه حل کن تا مطلب بنشیند.',
    },
];

let schemaReady = null;

function ensureBlogSchema() {
    if (!schemaReady) {
        schemaReady = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS blog_posts (
                    id INT NOT NULL AUTO_INCREMENT,
                    title VARCHAR(200) NOT NULL,
                    slug VARCHAR(180) NOT NULL,
                    excerpt VARCHAR(500) NULL,
                    body MEDIUMTEXT NOT NULL,
                    cover_url VARCHAR(500) NULL,
                    category VARCHAR(40) NOT NULL DEFAULT 'study',
                    featured TINYINT(1) NOT NULL DEFAULT 0,
                    published TINYINT(1) NOT NULL DEFAULT 0,
                    published_at DATETIME NULL,
                    author_admin_id INT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    UNIQUE KEY uq_blog_slug (slug),
                    KEY idx_blog_published (published, published_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
            `);
            for (const [column, definition] of [
                ['content', 'content LONGTEXT NULL'],
                ['author', 'author VARCHAR(120) NULL'],
                ['read_time', 'read_time VARCHAR(40) NULL'],
            ]) {
                const [cols] = await pool.query(`SHOW COLUMNS FROM blog_posts LIKE ?`, [column]);
                if (!cols.length) await pool.query(`ALTER TABLE blog_posts ADD COLUMN ${definition}`);
            }
            const [countRows] = await pool.query(`SELECT COUNT(*) AS n FROM blog_posts`);
            if (Number(countRows[0].n) === 0) {
                for (const post of SAMPLE_POSTS) {
                    await pool.query(
                        `INSERT INTO blog_posts (title, slug, excerpt, body, category, featured, published, published_at)
                         VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
                        [post.title, post.slug, post.excerpt, post.body, post.category, post.featured]
                    );
                }
            }
        })().catch((err) => {
            schemaReady = null;
            throw err;
        });
    }
    return schemaReady;
}

function readMinutes(body) {
    const words = String(body || '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 40) || 1);
}

function parseContent(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function plainFromContent(content) {
    return (content || []).map((block) => {
        if (block.type === 'list') return (block.items || []).join('\n');
        if (block.type === 'paragraph' || block.type === 'heading') {
            return String(block.text || '').replace(/<[^>]+>/g, ' ');
        }
        return block.caption || block.alt || '';
    }).join('\n').replace(/\s+/g, ' ').trim();
}

function mapPost(row, { includeBody = true } = {}) {
    const category = row.category || 'study';
    const content = parseContent(row.content);
    const plain = plainFromContent(content) || row.body || '';
    return {
        id: Number(row.id),
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt || cleanText(plain, 180),
        body: includeBody ? (row.body || plain) : '',
        content: includeBody ? content : undefined,
        coverUrl: row.cover_url || null,
        coverImage: row.cover_url || null,
        author: row.author || 'تیم متاتست',
        published: Number(row.published) === 1,
        publishedAt: row.published_at || null,
        category,
        categorySlug: category,
        categoryName: CATEGORIES[category] || 'آموزش',
        featured: Number(row.featured) === 1,
        readTime: row.read_time || `${readMinutes(plain).toLocaleString('fa-IR')} دقیقه`,
    };
}

const PUBLIC_COLUMNS = `id, title, slug, excerpt, body, content, cover_url, category, featured, author, read_time, published, published_at`;

async function handlePublicList(_req, res) {
    await ensureBlogSchema();
    const [rows] = await pool.query(
        `SELECT ${PUBLIC_COLUMNS} FROM blog_posts WHERE published = 1 ORDER BY featured DESC, published_at DESC, id DESC`
    );
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data: rows.map((row) => mapPost(row, { includeBody: false })) });
}

async function handlePublicOne(req, res) {
    await ensureBlogSchema();
    const slug = slugify(req.params.slug);
    if (!slug) return res.status(404).json({ success: false, message: 'مطلب پیدا نشد.' });
    const [rows] = await pool.query(
        `SELECT ${PUBLIC_COLUMNS} FROM blog_posts WHERE slug = ? AND published = 1 LIMIT 1`,
        [slug]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'مطلب پیدا نشد.' });
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data: mapPost(rows[0]) });
}

async function handleAdminList(_req, res) {
    await ensureBlogSchema();
    const [rows] = await pool.query(
        `SELECT ${PUBLIC_COLUMNS}, updated_at FROM blog_posts ORDER BY updated_at DESC, id DESC`
    );
    return res.json({ success: true, data: rows.map((row) => mapPost(row)) });
}

async function uniqueSlug(connection, base, ignoreId) {
    let slug = base || 'post';
    let n = 2;
    for (;;) {
        const [rows] = await connection.query(
            `SELECT id FROM blog_posts WHERE slug = ? AND id <> ? LIMIT 1`,
            [slug, ignoreId || 0]
        );
        if (!rows.length) return slug;
        const suffix = `-${n}`;
        slug = `${base.slice(0, 160 - suffix.length)}${suffix}`;
        n += 1;
        if (n > 50) return `${base.slice(0, 140)}-${Date.now()}`;
    }
}

async function handleAdminSave(req, res) {
    await ensureBlogSchema();
    const title = cleanText(req.body?.title, 200);
    const content = Array.isArray(req.body?.content) ? req.body.content.slice(0, 80) : [];
    const plain = plainFromContent(content);
    const body = cleanText(req.body?.body, 50000) || cleanText(plain, 50000);
    if (!title) return res.status(400).json({ success: false, message: 'عنوان را وارد کنید.' });
    if (!body && !content.length) return res.status(400).json({ success: false, message: 'متن مطلب را وارد کنید.' });
    const requested = slugify(req.body?.slug || title);
    if (!requested) return res.status(400).json({ success: false, message: 'نامک مطلب نامعتبر است.' });
    const category = CATEGORIES[req.body?.category] ? req.body.category : 'study';
    const excerpt = cleanText(req.body?.excerpt, 500) || cleanText(plain || body, 180);
    const coverUrl = cleanCoverUrl(req.body?.coverUrl || req.body?.coverImage);
    if (coverUrl === undefined) return res.status(400).json({ success: false, message: 'آدرس تصویر باید با http یا https شروع شود.' });
    const author = cleanText(req.body?.author, 120) || 'تیم متاتست';
    const readTime = cleanText(req.body?.readTime, 40) || null;
    const published = req.body?.published === true || req.body?.published === 1 || req.body?.published === '1' || req.body?.published === 'true';
    const featured = req.body?.featured === true || req.body?.featured === 1 || req.body?.featured === '1';
    const id = Number(req.body?.id || req.params?.id);
    const hasId = Number.isInteger(id) && id > 0;
    const contentJson = JSON.stringify(content);

    const connection = await pool.getConnection();
    try {
        const slug = await uniqueSlug(connection, requested, hasId ? id : 0);
        if (hasId) {
            const [existing] = await connection.query(`SELECT id, published_at FROM blog_posts WHERE id = ? LIMIT 1`, [id]);
            if (!existing.length) return res.status(404).json({ success: false, message: 'مطلب پیدا نشد.' });
            await connection.query(
                `UPDATE blog_posts
                 SET title = ?, slug = ?, excerpt = ?, body = ?, content = ?, cover_url = ?, category = ?, featured = ?, author = ?, read_time = ?, published = ?, published_at = ?
                 WHERE id = ?`,
                [title, slug, excerpt, body, contentJson, coverUrl, category, featured ? 1 : 0, author, readTime, published ? 1 : 0, published ? (existing[0].published_at || new Date()) : null, id]
            );
        } else {
            await connection.query(
                `INSERT INTO blog_posts (title, slug, excerpt, body, content, cover_url, category, featured, author, read_time, published, published_at, author_admin_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [title, slug, excerpt, body, contentJson, coverUrl, category, featured ? 1 : 0, author, readTime, published ? 1 : 0, published ? new Date() : null, req.admin?.id || null]
            );
        }
        return res.json({ success: true, message: published ? 'مطلب منتشر شد.' : 'پیش‌نویس ذخیره شد.' });
    } finally {
        connection.release();
    }
}

async function handleAdminDelete(req, res) {
    await ensureBlogSchema();
    const id = Number(req.params?.id || req.body?.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'شناسه مطلب نامعتبر است.' });
    const [result] = await pool.query(`DELETE FROM blog_posts WHERE id = ?`, [id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'مطلب پیدا نشد.' });
    return res.json({ success: true, message: 'مطلب حذف شد.' });
}

module.exports = {
    ensureBlogSchema,
    handlePublicList,
    handlePublicOne,
    handleAdminList,
    handleAdminSave,
    handleAdminDelete,
};
