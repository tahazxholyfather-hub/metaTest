'use strict';

const pool = require('../db');
const fs = require('fs');
const { slugify, cleanText, cleanCoverUrl, acceptedMediaUrl } = require('../blog/text');

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
            await pool.query(`
                CREATE TABLE IF NOT EXISTS blog_categories (
                    id INT NOT NULL AUTO_INCREMENT,
                    slug VARCHAR(80) NOT NULL,
                    name VARCHAR(80) NOT NULL,
                    sort_order INT NOT NULL DEFAULT 0,
                    PRIMARY KEY (id),
                    UNIQUE KEY uq_blog_cat_slug (slug)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS blog_post_categories (
                    post_id INT NOT NULL,
                    category_id INT NOT NULL,
                    PRIMARY KEY (post_id, category_id),
                    KEY idx_blog_post_cat (category_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
            `);
            const [catCount] = await pool.query(`SELECT COUNT(*) AS n FROM blog_categories`);
            if (Number(catCount[0].n) === 0) {
                let order = 1;
                for (const [slug, name] of Object.entries(CATEGORIES)) {
                    await pool.query(
                        `INSERT INTO blog_categories (slug, name, sort_order) VALUES (?, ?, ?)`,
                        [slug, name, order]
                    );
                    order += 1;
                }
            }
            await pool.query(`
                INSERT IGNORE INTO blog_post_categories (post_id, category_id)
                SELECT p.id, c.id
                FROM blog_posts p
                JOIN blog_categories c ON c.slug = p.category
            `);
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

function mapPost(row, { includeBody = true, categories = [] } = {}) {
    const linked = categories.length ? categories : [];
    const category = linked[0]?.slug || row.category || 'study';
    const content = parseContent(row.content);
    const plain = plainFromContent(content) || row.body || '';
    const names = linked.length
        ? linked.map((item) => item.name).join(' · ')
        : (CATEGORIES[category] || 'آموزش');
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
        categoryName: names,
        categories: linked.length ? linked : [{ slug: category, name: CATEGORIES[category] || 'آموزش' }],
        featured: Number(row.featured) === 1,
        readTime: row.read_time || `${readMinutes(plain).toLocaleString('fa-IR')} دقیقه`,
    };
}

async function categoriesByPost(ids) {
    const grouped = new Map();
    if (!ids.length) return grouped;
    const [links] = await pool.query(
        `SELECT pc.post_id, c.slug, c.name
         FROM blog_post_categories pc
         JOIN blog_categories c ON c.id = pc.category_id
         WHERE pc.post_id IN (?)
         ORDER BY c.sort_order, c.id`,
        [ids]
    );
    for (const link of links) {
        const list = grouped.get(link.post_id) || [];
        list.push({ slug: link.slug, name: link.name });
        grouped.set(link.post_id, list);
    }
    return grouped;
}

async function presentPosts(rows, options) {
    const grouped = await categoriesByPost(rows.map((row) => row.id));
    return rows.map((row) => mapPost(row, { ...options, categories: grouped.get(row.id) || [] }));
}

const PUBLIC_COLUMNS = `id, title, slug, excerpt, body, content, cover_url, category, featured, author, read_time, published, published_at`;

async function handlePublicList(_req, res) {
    await ensureBlogSchema();
    const [rows] = await pool.query(
        `SELECT ${PUBLIC_COLUMNS} FROM blog_posts WHERE published = 1 ORDER BY featured DESC, published_at DESC, id DESC`
    );
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data: await presentPosts(rows, { includeBody: false }) });
}

async function handlePublicCategories(_req, res) {
    await ensureBlogSchema();
    const [rows] = await pool.query(`SELECT slug, name FROM blog_categories ORDER BY sort_order, id`);
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data: rows });
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
    const [post] = await presentPosts(rows, { includeBody: true });
    return res.json({ success: true, data: post });
}

async function handleAdminList(_req, res) {
    await ensureBlogSchema();
    const [rows] = await pool.query(
        `SELECT ${PUBLIC_COLUMNS}, updated_at FROM blog_posts ORDER BY updated_at DESC, id DESC`
    );
    return res.json({ success: true, data: await presentPosts(rows) });
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
    const requestedCategories = Array.isArray(req.body?.categories) && req.body.categories.length
        ? req.body.categories
        : [req.body?.category].filter(Boolean);
    const categorySlugs = [...new Set(requestedCategories.map((item) => String(item || '').trim()).filter(Boolean))];
    if (!categorySlugs.length) return res.status(400).json({ success: false, message: 'حداقل یک دسته‌بندی انتخاب کنید.' });
    const [knownCategories] = await pool.query(
        `SELECT id, slug FROM blog_categories WHERE slug IN (?)`,
        [categorySlugs]
    );
    if (knownCategories.length !== categorySlugs.length) {
        return res.status(400).json({ success: false, message: 'یکی از دسته‌بندی‌ها پیدا نشد.' });
    }
    const orderedCategories = categorySlugs.map((slug) => knownCategories.find((item) => item.slug === slug)).filter(Boolean);
    const category = orderedCategories[0].slug;
    const excerpt = cleanText(req.body?.excerpt, 500) || cleanText(plain || body, 180);
    const coverUrl = cleanCoverUrl(req.body?.coverUrl || req.body?.coverImage);
    if (coverUrl === undefined) return res.status(400).json({ success: false, message: 'کاور باید از فایل انتخاب شود.' });
    const mediaBlocks = content.map((block) => {
        if (!block || (block.type !== 'image' && block.type !== 'video')) return block;
        const url = acceptedMediaUrl(block.url);
        if (url === null) return null;
        return { ...block, url };
    });
    if (mediaBlocks.some((block) => block === null)) {
        return res.status(400).json({ success: false, message: 'تصویر و ویدیو را با انتخاب فایل بگذار، نه با آدرس دستی.' });
    }
    const author = cleanText(req.body?.author, 120) || 'تیم متاتست';
    const readTime = cleanText(req.body?.readTime, 40) || null;
    const published = req.body?.published === true || req.body?.published === 1 || req.body?.published === '1' || req.body?.published === 'true';
    const featured = req.body?.featured === true || req.body?.featured === 1 || req.body?.featured === '1';
    const id = Number(req.body?.id || req.params?.id);
    const hasId = Number.isInteger(id) && id > 0;
    const contentJson = JSON.stringify(mediaBlocks);

    const connection = await pool.getConnection();
    try {
        const slug = await uniqueSlug(connection, requested, hasId ? id : 0);
        let postId = id;
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
            const [created] = await connection.query(
                `INSERT INTO blog_posts (title, slug, excerpt, body, content, cover_url, category, featured, author, read_time, published, published_at, author_admin_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [title, slug, excerpt, body, contentJson, coverUrl, category, featured ? 1 : 0, author, readTime, published ? 1 : 0, published ? new Date() : null, req.admin?.id || null]
            );
            postId = created.insertId;
        }
        await connection.query(`DELETE FROM blog_post_categories WHERE post_id = ?`, [postId]);
        for (const item of orderedCategories) {
            await connection.query(
                `INSERT INTO blog_post_categories (post_id, category_id) VALUES (?, ?)`,
                [postId, item.id]
            );
        }
        return res.json({ success: true, message: published ? 'مطلب منتشر شد.' : 'پیش‌نویس ذخیره شد.' });
    } finally {
        connection.release();
    }
}

function handleUploadMedia(req, res) {
    if (!req.file) return res.status(400).json({ success: false, message: 'فایلی انتخاب نشده.' });
    const video = String(req.file.mimetype || '').startsWith('video/');
    const max = video ? 80 * 1024 * 1024 : 12 * 1024 * 1024;
    if (req.file.size > max) {
        fs.unlink(req.file.path, () => undefined);
        return res.status(400).json({
            success: false,
            message: video ? 'ویدیو باید کوچک‌تر از ۸۰ مگابایت باشد.' : 'تصویر باید کوچک‌تر از ۱۲ مگابایت باشد.',
        });
    }
    return res.json({ success: true, url: `/blog-media/${req.file.filename}` });
}

async function listCategories() {
    const [rows] = await pool.query(`SELECT id, slug, name FROM blog_categories ORDER BY sort_order, id`);
    return rows;
}

async function handleAdminCategories(_req, res) {
    await ensureBlogSchema();
    return res.json({ success: true, data: await listCategories() });
}

async function handleAdminCreateCategory(req, res) {
    await ensureBlogSchema();
    const name = cleanText(req.body?.name, 80);
    if (!name) return res.status(400).json({ success: false, message: 'نام دسته‌بندی را وارد کنید.' });
    let slug = slugify(name) || `cat-${Date.now()}`;
    const [maxRows] = await pool.query(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM blog_categories`);
    for (let n = 2; n < 40; n += 1) {
        const [existing] = await pool.query(`SELECT id FROM blog_categories WHERE slug = ? LIMIT 1`, [slug]);
        if (!existing.length) break;
        slug = `${slugify(name).slice(0, 70) || 'cat'}-${n}`;
    }
    await pool.query(
        `INSERT INTO blog_categories (slug, name, sort_order) VALUES (?, ?, ?)`,
        [slug, name, Number(maxRows[0].n) || 1]
    );
    return res.json({ success: true, message: 'دسته‌بندی اضافه شد.', data: await listCategories() });
}

async function categoryUse(slug) {
    const [cats] = await pool.query(`SELECT id, slug, name FROM blog_categories WHERE slug = ? LIMIT 1`, [slug]);
    if (!cats.length) return null;
    const cat = cats[0];
    const [rows] = await pool.query(
        `SELECT post_id, COUNT(*) AS total, SUM(category_id = ?) AS hit
         FROM blog_post_categories
         GROUP BY post_id
         HAVING SUM(category_id = ?) > 0`,
        [cat.id, cat.id]
    );
    const onlyIds = rows.filter((row) => Number(row.total) === Number(row.hit)).map((row) => row.post_id);
    return {
        category: cat,
        onlyCount: onlyIds.length,
        sharedCount: rows.length - onlyIds.length,
        onlyIds,
    };
}

async function handleAdminCategoryImpact(req, res) {
    await ensureBlogSchema();
    const impact = await categoryUse(String(req.params.slug || ''));
    if (!impact) return res.status(404).json({ success: false, message: 'دسته‌بندی پیدا نشد.' });
    return res.json({
        success: true,
        data: { name: impact.category.name, onlyCount: impact.onlyCount, sharedCount: impact.sharedCount },
    });
}

async function handleAdminDeleteCategory(req, res) {
    await ensureBlogSchema();
    const impact = await categoryUse(String(req.params.slug || ''));
    if (!impact) return res.status(404).json({ success: false, message: 'دسته‌بندی پیدا نشد.' });
    const connection = await pool.getConnection();
    try {
        if (impact.onlyIds.length) {
            await connection.query(`DELETE FROM blog_posts WHERE id IN (?)`, [impact.onlyIds]);
        }
        await connection.query(`DELETE FROM blog_post_categories WHERE category_id = ?`, [impact.category.id]);
        await connection.query(`DELETE FROM blog_categories WHERE id = ?`, [impact.category.id]);
        return res.json({
            success: true,
            message: impact.onlyIds.length
                ? `دسته‌بندی حذف شد و ${impact.onlyIds.length.toLocaleString('fa-IR')} مقاله که فقط همین دسته را داشتند هم حذف شدند.`
                : 'دسته‌بندی حذف شد.',
            data: await listCategories(),
        });
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
    handlePublicCategories,
    handlePublicOne,
    handleAdminList,
    handleAdminSave,
    handleAdminDelete,
    handleUploadMedia,
    handleAdminCategories,
    handleAdminCreateCategory,
    handleAdminCategoryImpact,
    handleAdminDeleteCategory,
};
