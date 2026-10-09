'use strict';

const pool = require('../db');
const { publicAdmin } = require('../middleware/adminAuth');
const { backfillInsertedWords } = require('../admin/words');
const { catalog, listAccess, saveSections } = require('../admin/access');
const { resolveSections } = require('../admin/sections');

const REPORT_STATUSES = ['pending', 'investigating', 'resolved', 'rejected'];

function snippet(text, limit = 180) {
    const clean = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length <= limit) return clean;
    return `${clean.slice(0, limit)}…`;
}

const handleWordStats = async (req, res) => {
    let backfill = { complete: true, scanned: 0, logged: 0 };
    if (String(req.query.backfill || '') !== '0') {
        try {
            backfill = await backfillInsertedWords();
        } catch (err) {
            console.error('word backfill failed:', err.message);
            backfill = { complete: true, scanned: 0, logged: 0, error: 'Existing questions could not be indexed yet.' };
        }
    }

    const [admins] = await pool.query(
        `SELECT a.id, a.username, a.full_name, a.role, a.status,
                COALESCE(SUM(CASE WHEN e.action = 'insert' THEN e.word_count ELSE 0 END), 0) AS words_inserted,
                COALESCE(SUM(CASE WHEN e.action = 'edit' THEN e.word_count ELSE 0 END), 0) AS words_edited,
                COALESCE(SUM(CASE WHEN e.action = 'insert' AND e.word_count > 0 THEN 1 ELSE 0 END), 0) AS insert_events,
                COALESCE(SUM(CASE WHEN e.action = 'edit' AND e.word_count > 0 THEN 1 ELSE 0 END), 0) AS edit_events,
                MAX(e.created_at) AS last_activity
         FROM tam24_admins a
         LEFT JOIN tam24_admin_word_events e ON e.admin_id = a.id
         GROUP BY a.id, a.username, a.full_name, a.role, a.status
         ORDER BY (words_inserted + words_edited) DESC, a.id ASC`
    );

    let questionCounts = new Map();
    try {
        const [counts] = await pool.query(
            `SELECT admin_id, COUNT(*) AS questions_inserted FROM questions_tam24 GROUP BY admin_id`
        );
        questionCounts = new Map(counts.map((row) => [Number(row.admin_id), Number(row.questions_inserted)]));
    } catch (err) {
        console.error('question counts unavailable:', err.message);
    }

    const [recent] = await pool.query(
        `SELECT e.id, e.admin_id, e.action, e.question_id, e.word_count, e.source, e.created_at,
                a.username, a.full_name
         FROM tam24_admin_word_events e
         LEFT JOIN tam24_admins a ON a.id = e.admin_id
         WHERE e.word_count > 0
         ORDER BY e.id DESC
         LIMIT 40`
    );

    const rows = admins.map((row) => ({
        id: Number(row.id),
        username: row.username,
        fullName: row.full_name || '',
        role: row.role || 'admin',
        status: row.status || 'active',
        isSuper: Number(row.id) === 1,
        wordsInserted: Number(row.words_inserted) || 0,
        wordsEdited: Number(row.words_edited) || 0,
        insertEvents: Number(row.insert_events) || 0,
        editEvents: Number(row.edit_events) || 0,
        questionsInserted: questionCounts.get(Number(row.id)) || 0,
        lastActivity: row.last_activity || null,
    }));

    const totals = rows.reduce((sum, row) => {
        sum.wordsInserted += row.wordsInserted;
        sum.wordsEdited += row.wordsEdited;
        sum.questionsInserted += row.questionsInserted;
        return sum;
    }, { wordsInserted: 0, wordsEdited: 0, questionsInserted: 0 });

    return res.json({
        success: true,
        totals,
        admins: rows,
        recent: recent.map((row) => ({
            id: Number(row.id),
            adminId: Number(row.admin_id),
            username: row.username || '',
            fullName: row.full_name || '',
            action: row.action,
            questionId: row.question_id ? Number(row.question_id) : null,
            wordCount: Number(row.word_count) || 0,
            source: row.source,
            createdAt: row.created_at,
        })),
        backfill,
    });
};

const handleListReports = async (req, res) => {
    const status = String(req.query.status || '').trim();
    const q = String(req.query.q || '').trim();
    const pageSize = 20;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * pageSize;

    const where = ['1=1'];
    const params = [];
    if (status && status !== 'all') {
        if (!REPORT_STATUSES.includes(status)) {
            return res.json({ success: false, message: 'Invalid report status' });
        }
        where.push('r.status = ?');
        params.push(status);
    }
    if (q) {
        where.push('(r.report_text LIKE ? OR q.question_text LIKE ? OR CAST(r.question_id AS CHAR) = ?)');
        params.push(`%${q}%`, `%${q}%`, q);
    }
    const whereSql = where.join(' AND ');

    const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM reports_tam24 r
         LEFT JOIN questions_tam24 q ON q.id = r.question_id
         WHERE ${whereSql}`,
        params
    );

    const [rows] = await pool.query(
        `SELECT r.id, r.question_id, r.issue, r.report_text, r.reporter, r.reporter_id,
                r.status, r.date, r.note, q.question_text,
                u.username AS user_username,
                a.username AS admin_username, a.full_name AS admin_full_name
         FROM reports_tam24 r
         LEFT JOIN questions_tam24 q ON q.id = r.question_id
         LEFT JOIN tam24_users u ON r.reporter = 'user' AND u.id = r.reporter_id
         LEFT JOIN tam24_admins a ON r.reporter = 'admin' AND a.id = r.reporter_id
         WHERE ${whereSql}
         ORDER BY r.id DESC
         LIMIT ${pageSize} OFFSET ${offset}`,
        params
    );

    return res.json({
        success: true,
        page,
        pageSize,
        total: Number(countRow?.total) || 0,
        reports: rows.map((row) => ({
            id: Number(row.id),
            questionId: Number(row.question_id),
            issue: row.issue,
            reportText: row.report_text,
            questionSnippet: snippet(row.question_text),
            reporter: row.reporter,
            reporterId: Number(row.reporter_id),
            reporterName: row.reporter === 'admin'
                ? (row.admin_full_name || row.admin_username || `admin #${row.reporter_id}`)
                : (row.user_username || `user #${row.reporter_id}`),
            status: row.status,
            date: Number(row.date) || null,
            note: row.note || '',
        })),
    });
};

const handleUpdateReport = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.json({ success: false, message: 'Invalid report id' });

    const updates = [];
    const params = [];
    if (req.body.status !== undefined) {
        const status = String(req.body.status);
        if (!REPORT_STATUSES.includes(status)) {
            return res.json({ success: false, message: 'Invalid report status' });
        }
        updates.push('status = ?');
        params.push(status);
    }
    if (req.body.note !== undefined) {
        const note = String(req.body.note || '').trim();
        if (note.length > 5000) return res.json({ success: false, message: 'Note is too long.' });
        updates.push('note = ?');
        params.push(note || null);
    }
    if (!updates.length) return res.json({ success: false, message: 'Nothing to update' });

    const [[existing]] = await pool.query(`SELECT id FROM reports_tam24 WHERE id = ? LIMIT 1`, [id]);
    if (!existing) return res.json({ success: false, message: 'Report not found' });

    params.push(id);
    await pool.query(
        `UPDATE reports_tam24 SET ${updates.join(', ')} WHERE id = ?`,
        params
    );

    const [[row]] = await pool.query(
        `SELECT id, question_id, issue, status, note FROM reports_tam24 WHERE id = ? LIMIT 1`,
        [id]
    );
    return res.json({
        success: true,
        report: {
            id: Number(row.id),
            questionId: Number(row.question_id),
            issue: row.issue,
            status: row.status,
            note: row.note || '',
        },
    });
};

const handleListAccess = async (_req, res) => {
    const { admins, grouped } = await listAccess();
    return res.json({
        success: true,
        catalog: catalog(),
        admins: admins.map((row) => {
            const presented = publicAdmin(row);
            presented.sections = resolveSections(row.id, grouped.get(Number(row.id)) || []);
            return presented;
        }),
    });
};

const handleSaveAccess = async (req, res) => {
    const result = await saveSections(req.params.id, req.body.sections || req.body, req.admin?.id);
    if (!result.ok) {
        return res.status(result.status || 400).json({ success: false, message: result.message });
    }
    return res.json({ success: true, sections: result.sections });
};

module.exports = {
    handleWordStats,
    handleListReports,
    handleUpdateReport,
    handleListAccess,
    handleSaveAccess,
    REPORT_STATUSES,
};
