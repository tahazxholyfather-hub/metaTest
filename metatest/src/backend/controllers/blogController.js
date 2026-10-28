'use strict';

const pool = require('../db');
const { slugify, cleanText, cleanCoverUrl } = require('../blog/text');

let schemaReady = null;

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
            const [categoryCol] = await pool.query(`SHOW COLUMNS FROM blog_posts LIKE 'category'`);
            if (!categoryCol.length) {
                await pool.query(`ALTER TABLE blog_posts ADD COLUMN category VARCHAR(40) NOT NULL DEFAULT 'study'`);
            }
            const [featuredCol] = await pool.query(`SHOW COLUMNS FROM blog_posts LIKE 'featured'`);
            if (!featuredCol.length) {
                await pool.query(`ALTER TABLE blog_posts ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0`);
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
            } else {
                for (const post of SAMPLE_POSTS) {
                    await pool.query(
                        `UPDATE blog_posts SET category = ?, featured = ? WHERE slug = ?`,
                        [post.category, post.featured, post.slug]
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

function mapPost(row) {
    const category = row.category || 'study';
    const minutes = readMinutes(row.body);
    return {
        id: Number(row.id),
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt || '',
        body: row.body || '',
        coverUrl: row.cover_url || null,
        coverImage: row.cover_url || null,
        published: Number(row.published) === 1,
        publishedAt: row.published_at || null,
        updatedAt: row.updated_at || null,
        category,
        categorySlug: category,
        categoryName: CATEGORIES[category] || 'آموزش',
        featured: Number(row.featured) === 1,
        readTime: `${minutes.toLocaleString('fa-IR')} دقیقه`,
    };
}

function publicPost(row) {
    const post = mapPost(row);
    delete post.published;
    return post;
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

async function handlePublicList(_req, res) {
    await ensureBlogSchema();
    const [rows] = await pool.query(
        `SELECT id, title, slug, excerpt, body, cover_url, category, featured, published, published_at, updated_at
         FROM blog_posts
         WHERE published = 1
         ORDER BY published_at DESC, id DESC`
    );
    res.set('Cache-Control', 'no-store');
    return res.json({
        success: true,
        data: rows.map((row) => {
            const post = publicPost(row);
            post.body = '';
            if (!post.excerpt) post.excerpt = cleanText(row.body, 180);
            return post;
        }),
    });
}

async function handlePublicOne(req, res) {
    await ensureBlogSchema();
    const slug = slugify(req.params.slug);
    if (!slug) return res.status(404).json({ success: false, message: 'مطلب پیدا نشد.' });
    const [rows] = await pool.query(
        `SELECT id, title, slug, excerpt, body, cover_url, category, featured, published, published_at, updated_at
         FROM blog_posts
         WHERE slug = ? AND published = 1
         LIMIT 1`,
        [slug]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'مطلب پیدا نشد.' });
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data: publicPost(rows[0]) });
}

async function handleAdminList(_req, res) {
    await ensureBlogSchema();
    const [rows] = await pool.query(
        `SELECT id, title, slug, excerpt, body, cover_url, published, published_at, updated_at
         FROM blog_posts
         ORDER BY updated_at DESC, id DESC`
    );
    return res.json({ success: true, data: rows.map(mapPost) });
}

async function handleAdminSave(req, res) {
    await ensureBlogSchema();
    const title = cleanText(req.body?.title, 200);
    const body = cleanText(req.body?.body, 50000);
    if (!title) return res.json({ success: false, message: 'عنوان را وارد کنید.' });
    if (!body) return res.json({ success: false, message: 'متن مطلب را وارد کنید.' });
    const requestedSlug = slugify(req.body?.slug || title);
    if (!requestedSlug) return res.json({ success: false, message: 'نامک مطلب نامعتبر است.' });
    const excerpt = cleanText(req.body?.excerpt, 500) || cleanText(body, 180);
    const coverUrl = cleanCoverUrl(req.body?.coverUrl);
    if (coverUrl === undefined) return res.json({ success: false, message: 'آدرس تصویر باید با http یا https شروع شود.' });
    const published = req.body?.published === true || req.body?.published === 1 || req.body?.published === '1' || req.body?.published === 'true';
    const id = Number(req.body?.id);
    const hasId = Number.isInteger(id) && id > 0;
    const authorId = req.admin?.id || null;

    const connection = await pool.getConnection();
    try {
        const slug = await uniqueSlug(connection, requestedSlug, hasId ? id : 0);
        if (hasId) {
            const [existing] = await connection.query(`SELECT id, published_at FROM blog_posts WHERE id = ? LIMIT 1`, [id]);
            if (!existing.length) return res.json({ success: false, message: 'مطلب پیدا نشد.' });
            const publishedAt = published ? (existing[0].published_at || new Date()) : existing[0].published_at;
            await connection.query(
                `UPDATE blog_posts
                 SET title = ?, slug = ?, excerpt = ?, body = ?, cover_url = ?, published = ?, published_at = ?
                 WHERE id = ?`,
                [title, slug, excerpt, body, coverUrl, published ? 1 : 0, published ? publishedAt : null, id]
            );
        } else {
            await connection.query(
                `INSERT INTO blog_posts (title, slug, excerpt, body, cover_url, published, published_at, author_admin_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [title, slug, excerpt, body, coverUrl, published ? 1 : 0, published ? new Date() : null, authorId]
            );
        }
        return res.json({ success: true, message: published ? 'مطلب منتشر شد.' : 'پیش‌نویس ذخیره شد.' });
    } catch (err) {
        console.error('save blog:', err.message);
        return res.json({ success: false, message: 'ذخیره مطلب ممکن نشد.' });
    } finally {
        connection.release();
    }
}

async function handleAdminDelete(req, res) {
    await ensureBlogSchema();
    const id = Number(req.body?.id);
    if (!Number.isInteger(id) || id <= 0) return res.json({ success: false, message: 'شناسه مطلب نامعتبر است.' });
    const [result] = await pool.query(`DELETE FROM blog_posts WHERE id = ?`, [id]);
    if (!result.affectedRows) return res.json({ success: false, message: 'مطلب پیدا نشد.' });
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
