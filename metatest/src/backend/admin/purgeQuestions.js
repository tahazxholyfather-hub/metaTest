'use strict';

const pool = require('../db');
const { isSuperAdmin } = require('../middleware/adminAuth');
const {
    questionFingerprint,
    parsePurgeFilters,
    classifyUploads,
    attachHistory,
    emptyHistory,
    hasHistory,
    planPurge,
    parseQuestionIds,
    sqlDateTime,
    clip,
} = require('./questionMatch');

const MAX_FILES = 30;
const MAX_QUESTIONS = 5000;
const HISTORY_COUNTS = [
    ['tam24_user_answers', 'answers'],
    ['favorites_tam24', 'favorites'],
    ['notes_tam24', 'notes'],
    ['reports_tam24', 'reports'],
    ['review_later_tam24', 'review_later'],
    ['quiz_session_questions_tam24', 'sessions'],
];
const LOOSE_DELETE_TABLES = [
    'favorites_tam24',
    'quiz_session_questions_tam24',
    'question_grades_tam24',
    'question_topics_tam24',
    'question_mabhas_tam24',
];

function requireMainAdmin(req, res) {
    const id = Number(req.admin?.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return null;
    }
    if (!isSuperAdmin(req.admin)) {
        res.status(403).json({ success: false, message: 'فقط مدیر اصلی می‌تواند سوال‌های واردشده را پاک کند.' });
        return null;
    }
    return id;
}

function chunks(list, size) {
    const parts = [];
    for (let index = 0; index < list.length; index += size) parts.push(list.slice(index, index + size));
    return parts;
}

async function queryOptional(executor, sql, params = []) {
    try {
        const [rows] = await executor.query(sql, params);
        return rows;
    } catch (err) {
        if (err && (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1146 || err.errno === 1054)) {
            return [];
        }
        throw err;
    }
}

function addCount(map, id, key, count) {
    const history = map.get(id) || emptyHistory();
    history[key] += Number(count) || 0;
    map.set(id, history);
}

function parseIdList(raw) {
    if (Array.isArray(raw)) return raw.map(Number).filter((id) => Number.isInteger(id) && id > 0);
    if (raw == null || raw === '') return [];
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(parsed)) return [];
        return parsed.map(Number).filter((id) => Number.isInteger(id) && id > 0);
    } catch {
        return [];
    }
}

async function countHistory(executor, ids) {
    const map = new Map();
    if (!ids.length) return map;
    for (const chunk of chunks(ids, 800)) {
        const marks = chunk.map(() => '?').join(',');
        for (const [table, key] of HISTORY_COUNTS) {
            const rows = await queryOptional(
                executor,
                `SELECT question_id, COUNT(*) AS c FROM ${table} WHERE question_id IN (${marks}) GROUP BY question_id`,
                chunk
            );
            for (const row of rows) addCount(map, Number(row.question_id), key, row.c);
        }
        const aiRows = await queryOptional(
            executor,
            `SELECT question_id, COUNT(*) AS c FROM tam24_ai_conversations WHERE question_id IN (${marks}) GROUP BY question_id`,
            chunk
        );
        for (const row of aiRows) addCount(map, Number(row.question_id), 'ai', row.c);
    }

    const wanted = new Set(ids);
    const jsonSources = [
        ['quizzes', 'question_ids'],
        ['quizzes_tam24', 'question_ids'],
        ['bank_selections', 'question_ids_json'],
    ];
    for (const [table, column] of jsonSources) {
        const rows = await queryOptional(executor, `SELECT \`${column}\` AS ids FROM \`${table}\``);
        const seen = new Set();
        for (const row of rows) {
            for (const id of parseIdList(row.ids)) {
                if (!wanted.has(id) || seen.has(id)) continue;
                seen.add(id);
                addCount(map, id, 'quizzes', 1);
            }
        }
    }
    return map;
}

async function loadMatchRows(executor) {
    const [questions] = await executor.query(
        `SELECT id, question_text, status, insert_type, created_at, admin_id, edit_status,
                subject_id, grade_id, topic_id, chapter_id, difficulty_level
         FROM questions_tam24`
    );
    const [options] = await executor.query(
        `SELECT question_id, option_text FROM options_tam24 ORDER BY question_id ASC, id ASC`
    );
    const byQuestion = new Map();
    for (const option of options) {
        const id = Number(option.question_id);
        const list = byQuestion.get(id);
        if (list) list.push(option.option_text);
        else byQuestion.set(id, [option.option_text]);
    }
    return questions.map((question) => ({
        ...question,
        id: Number(question.id),
        options: byQuestion.get(Number(question.id)) || [],
    }));
}

function readUploads(body) {
    const files = body?.files;
    if (!Array.isArray(files) || files.length === 0) return { error: 'فایلی برای بررسی نفرستادی.' };
    if (files.length > MAX_FILES) return { error: `بیش از ${MAX_FILES} فایل را یکجا بررسی نکن.` };
    let questions = 0;
    const cleaned = [];
    for (const file of files) {
        const list = Array.isArray(file?.questions) ? file.questions : [];
        questions += list.length;
        if (questions > MAX_QUESTIONS) return { error: `بیش از ${MAX_QUESTIONS} سوال را یکجا بررسی نکن.` };
        cleaned.push({
            name: String(file?.name || 'file.docx').slice(0, 180),
            questions: list,
            invalid: Number(file?.invalid) || 0,
        });
    }
    return { error: null, files: cleaned };
}

async function handleAdminPreviewQuestionPurge(req, res) {
    try {
        if (requireMainAdmin(req, res) === null) return;
        const filters = parsePurgeFilters(req.body?.filters || {});
        if (filters.error) return res.json({ success: false, message: filters.error });
        const uploads = readUploads(req.body);
        if (uploads.error) return res.json({ success: false, message: uploads.error });

        const rows = await loadMatchRows(pool);
        const report = classifyUploads(uploads.files, rows, filters);
        const ids = [];
        for (const group of report.groups) {
            for (const copy of group.copies) ids.push(copy.id);
        }
        const history = await countHistory(pool, ids);
        attachHistory(report, history);

        const admins = await queryOptional(pool, `SELECT id, username, full_name FROM tam24_admins`);
        const names = new Map(admins.map((admin) => [Number(admin.id), admin.full_name || admin.username || '']));
        for (const group of report.groups) {
            for (const copy of group.copies) copy.admin_name = names.get(copy.admin_id) || '';
        }

        return res.json({ success: true, ...report });
    } catch (error) {
        console.error('Admin_preview_question_purge error:', error);
        return res.json({ success: false, message: 'بررسی سوال‌ها ناموفق بود.' });
    }
}

async function loadSnapshots(executor, ids) {
    const questions = [];
    const optionMap = new Map();
    const descriptive = new Map();
    for (const chunk of chunks(ids, 400)) {
        const marks = chunk.map(() => '?').join(',');
        const [rows] = await executor.query(
            `SELECT id, question_text, status, insert_type, created_at, admin_id, edit_status,
                    subject_id, grade_id, topic_id, chapter_id, difficulty_level
             FROM questions_tam24 WHERE id IN (${marks})`,
            chunk
        );
        questions.push(...rows);
        const [options] = await executor.query(
            `SELECT id, question_id, option_text, is_correct
             FROM options_tam24 WHERE question_id IN (${marks}) ORDER BY question_id ASC, id ASC`,
            chunk
        );
        for (const option of options) {
            const id = Number(option.question_id);
            const list = optionMap.get(id) || [];
            list.push({
                id: Number(option.id),
                text: option.option_text,
                is_correct: Number(option.is_correct) === 1,
            });
            optionMap.set(id, list);
        }
        const answers = await queryOptional(
            executor,
            `SELECT question_id, answer_text FROM descriptive_answers_tam24 WHERE question_id IN (${marks})`,
            chunk
        );
        for (const answer of answers) {
            if (!descriptive.has(Number(answer.question_id))) {
                descriptive.set(Number(answer.question_id), answer.answer_text || '');
            }
        }
    }
    return questions.map((question) => ({
        id: Number(question.id),
        question_text: question.question_text,
        options: optionMap.get(Number(question.id)) || [],
        descriptive: descriptive.get(Number(question.id)) || '',
        status: question.status,
        insert_type: question.insert_type,
        created_at: sqlDateTime(question.created_at),
        admin_id: question.admin_id == null ? null : Number(question.admin_id),
        edit_status: question.edit_status,
        subject_id: question.subject_id,
        grade_id: question.grade_id,
        topic_id: question.topic_id,
        chapter_id: question.chapter_id,
        difficulty_level: question.difficulty_level,
        has_history: false,
    }));
}

async function clearLooseRefs(executor, ids) {
    if (!ids.length) return;
    const marks = ids.map(() => '?').join(',');
    for (const table of LOOSE_DELETE_TABLES) {
        await queryOptional(executor, `DELETE FROM \`${table}\` WHERE question_id IN (${marks})`, ids);
    }
}

async function deleteQuestions(executor, ids) {
    const deleted = [];
    const blocked = [];
    for (const id of ids) {
        await executor.query('SAVEPOINT purge_one');
        try {
            await clearLooseRefs(executor, [id]);
            await executor.query(`DELETE FROM questions_tam24 WHERE id = ?`, [id]);
            deleted.push(id);
        } catch (err) {
            await executor.query('ROLLBACK TO SAVEPOINT purge_one');
            console.error(`purge delete blocked for question ${id}:`, err.message);
            blocked.push(id);
        }
    }
    return { deleted, blocked };
}

async function deactivateQuestions(executor, ids, adminId) {
    for (const chunk of chunks(ids, 400)) {
        await executor.query(
            `UPDATE questions_tam24
             SET status = 'غیرفعال', last_edit_date = NOW(), last_edit_by = ?
             WHERE id IN (${chunk.map(() => '?').join(',')})`,
            [adminId, ...chunk]
        );
    }
}

async function ensurePurgeLog() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tam24_question_purge_log (
            id BIGINT NOT NULL AUTO_INCREMENT,
            admin_id INT NOT NULL,
            mode VARCHAR(20) NOT NULL,
            deleted_count INT NOT NULL,
            deactivated_count INT NOT NULL,
            snapshot_json LONGTEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
}

function compactSnapshot(items) {
    return items.map((item) => ({
        id: item.id,
        action: item.action,
        status: item.status,
        created_at: item.created_at,
        admin_id: item.admin_id,
        text: clip(item.question_text, 180),
    }));
}

async function handleAdminApplyQuestionPurge(req, res) {
    const adminId = requireMainAdmin(req, res);
    if (adminId === null) return;
    if (req.body?.confirm !== 'پاکسازی') {
        return res.json({ success: false, message: 'پاکسازی تأیید نشده است.' });
    }
    const mode = req.body?.mode === 'delete' ? 'delete' : req.body?.mode === 'deactivate' ? 'deactivate' : '';
    const parsedIds = parseQuestionIds(req.body?.question_ids);
    if (parsedIds.error) return res.json({ success: false, message: parsedIds.error });
    if (!mode) return res.json({ success: false, message: 'نوع پاکسازی نامعتبر است.' });

    const connection = await pool.getConnection();
    let started = false;
    try {
        const snapshots = await loadSnapshots(connection, parsedIds.ids);
        const foundIds = snapshots.map((item) => item.id);
        const history = await countHistory(connection, foundIds);
        for (const item of snapshots) {
            const itemHistory = history.get(item.id) || emptyHistory();
            item.history = itemHistory;
            item.has_history = hasHistory(itemHistory);
        }
        const planned = planPurge(snapshots, mode);
        if (planned.error) return res.json({ success: false, message: planned.error });
        const actionById = new Map(planned.plan.map((item) => [item.id, item.action]));

        await connection.beginTransaction();
        started = true;
        const deleteIds = planned.plan.filter((item) => item.action === 'delete').map((item) => item.id);
        const deactivateIds = planned.plan.filter((item) => item.action === 'deactivate').map((item) => item.id);
        const removed = await deleteQuestions(connection, deleteIds);
        const fallback = removed.blocked.filter((id) => !deactivateIds.includes(id));
        const deactivatedIds = [...deactivateIds, ...fallback];
        if (deactivatedIds.length) await deactivateQuestions(connection, deactivatedIds, adminId);
        await connection.commit();

        const deletedSet = new Set(removed.deleted);
        const deactivatedSet = new Set(deactivatedIds);
        for (const item of snapshots) {
            if (deletedSet.has(item.id)) item.action = 'delete';
            else if (deactivatedSet.has(item.id)) item.action = 'deactivate';
            else item.action = actionById.get(item.id) || 'skipped';
        }
        const missing = parsedIds.ids.filter((id) => !foundIds.includes(id));
        const payload = {
            deleted: removed.deleted,
            deactivated: deactivatedIds,
            missing,
        };

        let logId = null;
        try {
            await ensurePurgeLog();
            const full = JSON.stringify(snapshots);
            const stored = full.length > 6_000_000 ? JSON.stringify(compactSnapshot(snapshots)) : full;
            const [logged] = await pool.query(
                `INSERT INTO tam24_question_purge_log
                    (admin_id, mode, deleted_count, deactivated_count, snapshot_json)
                 VALUES (?, ?, ?, ?, ?)`,
                [adminId, mode, removed.deleted.length, deactivatedIds.length, stored]
            );
            logId = logged.insertId;
        } catch (logError) {
            console.error('purge log failed:', logError.message);
        }

        return res.json({
            success: true,
            message: `${removed.deleted.length} سوال حذف شد و ${deactivatedIds.length} سوال غیرفعال شد.`,
            log_id: logId,
            snapshot: snapshots,
            ...payload,
        });
    } catch (error) {
        if (started) await connection.rollback().catch(() => {});
        console.error('Admin_apply_question_purge error:', error);
        return res.json({ success: false, message: 'پاکسازی سوال‌ها ناموفق بود.' });
    } finally {
        connection.release();
    }
}

async function findExactDuplicates(executor, questions) {
    const texts = [];
    const seen = new Set();
    for (const question of questions) {
        const text = String(question?.text || '').trim();
        if (!text || seen.has(text)) continue;
        seen.add(text);
        texts.push(text);
    }
    if (!texts.length) return [];

    const rows = [];
    for (const chunk of chunks(texts, 40)) {
        const [found] = await executor.query(
            `SELECT id, question_text FROM questions_tam24 WHERE question_text IN (${chunk.map(() => '?').join(',')})`,
            chunk
        );
        rows.push(...found);
    }
    if (!rows.length) return [];

    const optionMap = new Map();
    for (const chunk of chunks(rows.map((row) => Number(row.id)), 400)) {
        const [options] = await executor.query(
            `SELECT question_id, option_text FROM options_tam24
             WHERE question_id IN (${chunk.map(() => '?').join(',')})
             ORDER BY question_id ASC, id ASC`,
            chunk
        );
        for (const option of options) {
            const id = Number(option.question_id);
            const list = optionMap.get(id);
            if (list) list.push(option.option_text);
            else optionMap.set(id, [option.option_text]);
        }
    }

    const byText = new Map();
    for (const row of rows) {
        const text = String(row.question_text || '').trim();
        const list = byText.get(text) || [];
        list.push({
            id: Number(row.id),
            fp: questionFingerprint(row.question_text, optionMap.get(Number(row.id)) || []),
        });
        byText.set(text, list);
    }

    const duplicates = [];
    questions.forEach((question, index) => {
        const text = String(question?.text || '').trim();
        const fp = questionFingerprint(text, question?.options || []);
        const hits = (byText.get(text) || []).filter((item) => item.fp === fp);
        if (!hits.length) return;
        duplicates.push({
            index: index + 1,
            count: hits.length,
            existing_ids: hits.map((item) => item.id),
            preview: clip(text, 140),
        });
    });
    return duplicates;
}

module.exports = {
    handleAdminPreviewQuestionPurge,
    handleAdminApplyQuestionPurge,
    findExactDuplicates,
};
