'use strict';

const pool = require('../db');
const { ensureBlogSchema } = require('./blogController');
const { validateComment } = require('../blog/commentInput');

const STATUSES = new Set(['pending', 'approved']);
const hits = new Map();

function clientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim().slice(0, 64);
    return String(req.socket?.remoteAddress || '').slice(0, 64) || null;
}

function rateLimited(ip) {
    const key = ip || 'unknown';
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const recent = (hits.get(key) || []).filter((stamp) => now - stamp < windowMs);
    if (recent.length >= 6) {
        hits.set(key, recent);
        return true;
    }
    recent.push(now);
    hits.set(key, recent);
    return false;
}

function present(row, withPost) {
    const comment = {
        id: Number(row.id),
        postId: Number(row.post_id),
        name: row.author_name,
        body: row.body,
        status: STATUSES.has(row.status) ? row.status : 'pending',
        source: row.source === 'admin' ? 'admin' : 'visitor',
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    };
    if (withPost) {
        comment.postTitle = row.post_title || '';
        comment.postSlug = row.post_slug || '';
    }
    return comment;
}

async function counts() {
    const [rows] = await pool.query(
        `SELECT post_id, status, COUNT(*) AS n FROM blog_comments GROUP BY post_id, status`
    );
    const byPost = {};
    const summary = { pending: 0, approved: 0 };
    for (const row of rows) {
        const postId = Number(row.post_id);
        const status = STATUSES.has(row.status) ? row.status : 'pending';
        const n = Number(row.n);
        if (!byPost[postId]) byPost[postId] = { postId, pending: 0, approved: 0 };
        byPost[postId][status] += n;
        summary[status] += n;
    }
    return { summary, byPost: Object.values(byPost) };
}

async function handlePublicList(req, res) {
    await ensureBlogSchema();
    const slug = String(req.params.slug || '').trim();
    const [posts] = await pool.query(
        `SELECT id, title FROM blog_posts WHERE slug = ? AND published = 1 LIMIT 1`,
        [slug]
    );
    if (!posts.length) return res.status(404).json({ success: false, message: 'مطلب پیدا نشد.' });
    const [rows] = await pool.query(
        `SELECT id, post_id, author_name, body, status, source, created_at
         FROM blog_comments
         WHERE post_id = ? AND status = 'approved'
         ORDER BY created_at DESC, id DESC
         LIMIT 100`,
        [posts[0].id]
    );
    return res.json({ success: true, comments: rows.map((row) => present(row, false)) });
}

async function handlePublicSubmit(req, res) {
    if (String(req.body?.website || '').trim()) {
        return res.json({ success: true, message: 'دیدگاه ثبت شد و بعد از تأیید نمایش داده می‌شود.' });
    }
    if (rateLimited(clientIp(req))) {
        return res.status(429).json({ success: false, message: 'دیدگاه‌های زیادی فرستاده شده. چند دقیقه بعد دوباره تلاش کنید.' });
    }
    const parsed = validateComment(req.body || {});
    if (!parsed.ok) {
        return res.status(400).json({ success: false, message: 'دیدگاه را کامل کنید.', errors: parsed.errors });
    }
    await ensureBlogSchema();
    const slug = String(req.params.slug || '').trim();
    const [posts] = await pool.query(
        `SELECT id FROM blog_posts WHERE slug = ? AND published = 1 LIMIT 1`,
        [slug]
    );
    if (!posts.length) return res.status(404).json({ success: false, message: 'مطلب پیدا نشد.' });
    await pool.query(
        `INSERT INTO blog_comments (post_id, author_name, body, status, source, ip)
         VALUES (?, ?, ?, 'pending', 'visitor', ?)`,
        [posts[0].id, parsed.value.name, parsed.value.body, clientIp(req)]
    );
    return res.json({ success: true, message: 'دیدگاه ثبت شد و بعد از تأیید نمایش داده می‌شود.' });
}

async function handleAdminList(req, res) {
    await ensureBlogSchema();
    const postId = Number(req.query.postId || 0);
    const status = String(req.query.status || 'all');
    const where = [];
    const params = [];
    if (Number.isInteger(postId) && postId > 0) {
        where.push('c.post_id = ?');
        params.push(postId);
    }
    if (STATUSES.has(status)) {
        where.push('c.status = ?');
        params.push(status);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(
        `SELECT c.id, c.post_id, c.author_name, c.body, c.status, c.source, c.created_at,
                p.title AS post_title, p.slug AS post_slug
         FROM blog_comments c
         JOIN blog_posts p ON p.id = c.post_id
         ${clause}
         ORDER BY c.created_at DESC, c.id DESC
         LIMIT 300`,
        params
    );
    const tally = await counts();
    return res.json({
        success: true,
        comments: rows.map((row) => present(row, true)),
        summary: tally.summary,
        byPost: tally.byPost,
    });
}

async function handleAdminCreate(req, res) {
    await ensureBlogSchema();
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId) || postId < 1) {
        return res.status(400).json({ success: false, message: 'شناسه مطلب نامعتبر است.' });
    }
    const parsed = validateComment(req.body || {});
    if (!parsed.ok) {
        return res.status(400).json({ success: false, message: 'دیدگاه را کامل کنید.', errors: parsed.errors });
    }
    const [posts] = await pool.query(`SELECT id, title, slug FROM blog_posts WHERE id = ? LIMIT 1`, [postId]);
    if (!posts.length) return res.status(404).json({ success: false, message: 'مطلب پیدا نشد.' });
    const [result] = await pool.query(
        `INSERT INTO blog_comments (post_id, author_name, body, status, source, ip)
         VALUES (?, ?, ?, 'approved', 'admin', ?)`,
        [postId, parsed.value.name, parsed.value.body, clientIp(req)]
    );
    return res.json({
        success: true,
        message: 'دیدگاه روی مطلب نمایش داده می‌شود.',
        comment: {
            id: Number(result.insertId),
            postId,
            name: parsed.value.name,
            body: parsed.value.body,
            status: 'approved',
            source: 'admin',
            createdAt: new Date().toISOString(),
            postTitle: posts[0].title,
            postSlug: posts[0].slug,
        },
    });
}

async function handleAdminUpdate(req, res) {
    await ensureBlogSchema();
    const id = Number(req.params.id);
    const status = String(req.body?.status || '');
    if (!Number.isInteger(id) || id < 1 || !STATUSES.has(status)) {
        return res.status(400).json({ success: false, message: 'وضعیت دیدگاه معتبر نیست.' });
    }
    const [result] = await pool.query(`UPDATE blog_comments SET status = ? WHERE id = ?`, [status, id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'دیدگاه پیدا نشد.' });
    return res.json({ success: true });
}

async function handleAdminDelete(req, res) {
    await ensureBlogSchema();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ success: false, message: 'شناسه دیدگاه نامعتبر است.' });
    }
    const [result] = await pool.query(`DELETE FROM blog_comments WHERE id = ?`, [id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'دیدگاه پیدا نشد.' });
    return res.json({ success: true, message: 'دیدگاه حذف شد.' });
}

module.exports = {
    handlePublicList,
    handlePublicSubmit,
    handleAdminList,
    handleAdminCreate,
    handleAdminUpdate,
    handleAdminDelete,
};
